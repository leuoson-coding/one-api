import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Header, Segment, Icon, Message } from 'semantic-ui-react';
import { API, showError } from '../helpers';

const VSCodeGitHubCallback = () => {
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleGitHubCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        
        // 获取保存的 VSCode 回调信息
        const vscodeRedirectUri = sessionStorage.getItem('vscode_redirect_uri');
        const vscodeState = sessionStorage.getItem('vscode_state');
        
        if (errorParam) {
          throw new Error(`GitHub 授权失败: ${searchParams.get('error_description') || errorParam}`);
        }
        
        if (!code) {
          throw new Error('未收到 GitHub 授权码');
        }
        
        if (!vscodeRedirectUri) {
          throw new Error('缺少 VSCode 回调地址信息');
        }

        // 调用后端 GitHub OAuth 处理
        const response = await API.get(`/api/oauth/github?code=${code}&state=${state}`);
        
        if (response.data.success) {
          // GitHub 登录成功，生成 VSCode 授权码
          const authCode = `vscode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // 清理 sessionStorage
          sessionStorage.removeItem('vscode_redirect_uri');
          sessionStorage.removeItem('vscode_state');
          
          // 跳转到 VSCode 回调页面
          const callbackUrl = new URL(vscodeRedirectUri);
          callbackUrl.searchParams.set('code', authCode);
          if (vscodeState) {
            callbackUrl.searchParams.set('state', vscodeState);
          }
          
          window.location.href = callbackUrl.toString();
        } else {
          throw new Error(response.data.message || 'GitHub 登录处理失败');
        }
      } catch (error) {
        console.error('VSCode GitHub 回调处理失败:', error);
        setError(error.message);
        setProcessing(false);
      }
    };

    handleGitHubCallback();
  }, [searchParams]);

  if (processing) {
    return (
      <Container style={{ marginTop: '2em' }}>
        <Segment basic textAlign='center'>
          <Icon loading name='spinner' size='large' />
          <Header as='h3'>正在处理 GitHub 授权...</Header>
          <p>请稍候，正在验证您的 GitHub 账户并生成授权码。</p>
        </Segment>
      </Container>
    );
  }

  return (
    <Container style={{ marginTop: '2em', maxWidth: '600px' }}>
      <Segment>
        <Header as='h2' textAlign='center' color='red'>
          <Icon name='exclamation triangle' />
          授权处理失败
        </Header>
        
        <Message negative>
          <Message.Header>处理 GitHub 授权时出现错误</Message.Header>
          <p>{error}</p>
        </Message>
        
        <Message info>
          <Message.Header>解决方案</Message.Header>
          <Message.List>
            <Message.Item>请返回 VSCode 插件重新尝试登录</Message.Item>
            <Message.Item>确保您的 GitHub 账户已正确配置</Message.Item>
            <Message.Item>检查网络连接是否正常</Message.Item>
          </Message.List>
        </Message>
      </Segment>
    </Container>
  );
};

export default VSCodeGitHubCallback;
