package auth

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/random"
	"github.com/songquanpeng/one-api/model"
)

// VSCode认证的三个标准端点

// 1. 获取授权URL - GET /vscode/authorize
func VSCodeAuthorize(c *gin.Context) {
	// 生成state参数
	state := random.GetRandomString(12)
	session := sessions.Default(c)
	session.Set("vscode_oauth_state", state)
	err := session.Save()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":             "server_error",
			"error_description": "会话保存失败",
		})
		return
	}

	// 构建GitHub OAuth URL（或其他OAuth提供商）
	redirectURI := c.Query("redirect_uri") // VSCode传入的回调URI
	if redirectURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "invalid_request",
			"error_description": "缺少 redirect_uri 参数",
		})
		return
	}

	authURL := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&state=%s&scope=user:email",
		config.GitHubClientId,
		url.QueryEscape(redirectURI),
		state,
	)

	c.JSON(http.StatusOK, gin.H{
		"authorization_url": authURL,
		"state":             state,
	})
}

// 2. 处理OAuth回调 - POST /vscode/callback
func VSCodeCallback(c *gin.Context) {
	var req struct {
		Code        string `json:"code"`
		State       string `json:"state"`
		RedirectURI string `json:"redirect_uri"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "invalid_request",
			"error_description": "参数错误",
		})
		return
	}

	// 验证state
	session := sessions.Default(c)
	storedState := session.Get("vscode_oauth_state")
	if storedState == nil || req.State != storedState.(string) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "invalid_state",
			"error_description": "state参数无效",
		})
		return
	}

	// 复用现有的GitHub OAuth逻辑
	githubUser, err := getGitHubUserInfoByCode(req.Code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "invalid_grant",
			"error_description": err.Error(),
		})
		return
	}

	// 查找或创建用户（复用现有逻辑）
	user := model.User{GitHubId: githubUser.Login}
	if model.IsGitHubIdAlreadyTaken(user.GitHubId) {
		err = user.FillUserByGitHubId()
	} else {
		user.Username = githubUser.Login
		user.DisplayName = githubUser.Name
		user.Email = githubUser.Email
		err = user.Insert(c.Request.Context(), 0)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":             "server_error",
			"error_description": "用户处理失败",
		})
		return
	}

	if user.Status != model.UserStatusEnabled {
		c.JSON(http.StatusForbidden, gin.H{
			"error":             "access_denied",
			"error_description": "用户已被封禁",
		})
		return
	}

	// 生成访问令牌
	accessToken, err := generateVSCodeAccessToken(user.Id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":             "server_error",
			"error_description": "生成访问令牌失败",
		})
		return
	}

	// 返回符合VSCode规范的响应
	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"token_type":   "Bearer",
		"scope":        "user",
		"account": gin.H{
			"id":    user.Id,
			"label": user.Username,
			"email": user.Email,
		},
	})
}

// 3. 获取用户信息 - GET /vscode/user
func VSCodeUser(c *gin.Context) {
	// 从Authorization header获取token
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":             "unauthorized",
			"error_description": "缺少访问令牌",
		})
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	userId, err := validateVSCodeAccessToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":             "invalid_token",
			"error_description": "访问令牌无效",
		})
		return
	}

	// 获取用户信息
	user := &model.User{Id: userId}
	if err := user.FillUserById(); err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":             "user_not_found",
			"error_description": "用户不存在",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           user.Id,
		"username":     user.Username,
		"email":        user.Email,
		"display_name": user.DisplayName,
		"role":         user.Role,
	})
}

// 辅助函数：生成VSCode专用访问令牌
func generateVSCodeAccessToken(userId int) (string, error) {
	// 使用JWT生成访问令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userId,
		"scope":   "vscode",
		"exp":     time.Now().Add(time.Hour * 24 * 30).Unix(), // 30天过期
		"iat":     time.Now().Unix(),
	})

	return token.SignedString([]byte(config.SessionSecret))
}

// 辅助函数：验证VSCode访问令牌
func validateVSCodeAccessToken(tokenString string) (int, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// 验证签名方法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(config.SessionSecret), nil
	})

	if err != nil || !token.Valid {
		return 0, errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("invalid claims")
	}

	// 验证scope
	scope, ok := claims["scope"].(string)
	if !ok || scope != "vscode" {
		return 0, errors.New("invalid scope")
	}

	userIdFloat, ok := claims["user_id"].(float64)
	if !ok {
		return 0, errors.New("invalid user_id")
	}

	return int(userIdFloat), nil
}
