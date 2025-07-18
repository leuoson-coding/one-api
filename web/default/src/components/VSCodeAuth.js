import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Header, Segment, Button, Message, Icon, Divider, Form } from 'semantic-ui-react';
import { API, showError, showSuccess } from '../helpers';
import { getOAuthState } from './utils';

const VSCodeAuth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [redirectUri, setRedirectUri] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    // 获取 VSCode 传入的参数
    const uri = searchParams.get('redirect_uri');
    const stateParam = searchParams.get('state');
    
    if (uri) {
      setRedirectUri(uri);
    }
    if (stateParam) {
      setState(stateParam);
    }
  }, [searchParams]);

  // GitHub OAuth 登录
  const handleGitHubLogin = async () => {
    if (!redirectUri) {
      showError('缺少回调地址参数');
      return;
    }

    try {
      const oauthState = await getOAuthState();
      if (!oauthState) return;

      // 构建 GitHub OAuth URL，但回调到我们的处理页面
      const githubUrl = `https://github.com/login/oauth/authorize?client_id=${window.localStorage.getItem('github_client_id') || ''}&state=${oauthState}&scope=user:email&redirect_uri=${encodeURIComponent(window.location.origin + '/vscode/github-callback')}`;
      
      // 保存 VSCode 的回调信息到 sessionStorage
      sessionStorage.setItem('vscode_redirect_uri', redirectUri);
      sessionStorage.setItem('vscode_state', state);
      
      window.location.href = githubUrl;
    } catch (error) {
      showError('GitHub 登录失败: ' + error.message);
    }
  };

  // 邮箱密码登录
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      showError('请填写用户名和密码');
      return;
    }

    setLoading(true);
    try {
      const response = await API.post('/api/user/login', {
        username: loginForm.username,
        password: loginForm.password
      });

      if (response.data.success) {
        // 登录成功，生成授权码并跳转
        await handleLoginSuccess(response.data.data);
      } else {
        showError(response.data.message || '登录失败');
      }
    } catch (error) {
      showError('登录请求失败: ' + error.message);
    }
    setLoading(false);
  };

  // 登录成功后的处理
  const handleLoginSuccess = async (userData) => {
    try {
      // 模拟生成授权码（实际应该由后端生成）
      const authCode = `vscode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 跳转到授权码显示页面
      const callbackUrl = new URL(redirectUri || '/vscode/callback', window.location.origin);
      callbackUrl.searchParams.set('code', authCode);
      if (state) {
        callbackUrl.searchParams.set('state', state);
      }
      
      window.location.href = callbackUrl.toString();
    } catch (error) {
      showError('授权处理失败: ' + error.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <Container style={{ marginTop: '2em', maxWidth: '500px' }}>
      <Segment>
        <Header as='h2' textAlign='center' color='blue'>
          <Icon name='code' />
          VSCode 插件登录
        </Header>
        
        <Message info>
          <Message.Header>授权说明</Message.Header>
          <p>请选择登录方式来授权 VSCode 插件访问您的账户。</p>
        </Message>

        {/* GitHub OAuth 登录 */}
        <Segment>
          <Header as='h4'>
            <Icon name='github' />
            GitHub 账户登录
          </Header>
          <Button 
            fluid 
            color='black'
            onClick={handleGitHubLogin}
            disabled={!redirectUri}
          >
            <Icon name='github' />
            使用 GitHub 账户登录
          </Button>
        </Segment>

        <Divider horizontal>或</Divider>

        {/* 邮箱密码登录 */}
        <Segment>
          <Header as='h4'>
            <Icon name='mail' />
            邮箱密码登录
          </Header>
          <Form onSubmit={handleEmailLogin}>
            <Form.Field>
              <label>用户名/邮箱</label>
              <Form.Input
                name='username'
                placeholder='请输入用户名或邮箱'
                value={loginForm.username}
                onChange={handleInputChange}
                required
              />
            </Form.Field>
            <Form.Field>
              <label>密码</label>
              <Form.Input
                name='password'
                type='password'
                placeholder='请输入密码'
                value={loginForm.password}
                onChange={handleInputChange}
                required
              />
            </Form.Field>
            <Button 
              type='submit' 
              primary 
              fluid 
              loading={loading}
              disabled={!redirectUri}
            >
              <Icon name='sign in' />
              登录
            </Button>
          </Form>
        </Segment>

        {!redirectUri && (
          <Message warning>
            <Message.Header>参数缺失</Message.Header>
            <p>缺少必要的回调地址参数，请从 VSCode 插件重新发起登录。</p>
          </Message>
        )}

        <Message size='small'>
          <Icon name='info circle' />
          登录后将生成授权码，请将授权码复制到 VSCode 插件中完成授权。
        </Message>
      </Segment>
    </Container>
  );
};

export default VSCodeAuth;
