import React, { useState } from 'react';
import { Container, Header, Segment, Button, Message, Form, Input } from 'semantic-ui-react';
import { API } from '../helpers';

const VSCodeAuthTest = () => {
  const [authUrl, setAuthUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getAuthUrl = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/api/vscode/authorize?redirect_uri=http://localhost:3001/vscode/callback');
      if (response.data.authorization_url) {
        setAuthUrl(response.data.authorization_url);
      } else {
        setError('获取授权URL失败');
      }
    } catch (err) {
      setError('请求失败: ' + (err.response?.data?.error_description || err.message));
    }
    setLoading(false);
  };

  const testCallback = async () => {
    setLoading(true);
    setError('');
    try {
      // 模拟回调请求
      const response = await API.post('/api/vscode/callback', {
        code: 'test-code-123',
        state: 'test-state',
        redirect_uri: 'http://localhost:3001/vscode/callback'
      });
      
      if (response.data.access_token) {
        setAccessToken(response.data.access_token);
      } else {
        setError('获取访问令牌失败: ' + (response.data.error_description || '未知错误'));
      }
    } catch (err) {
      setError('回调请求失败: ' + (err.response?.data?.error_description || err.message));
    }
    setLoading(false);
  };

  const getUserInfo = async () => {
    if (!accessToken) {
      setError('请先获取访问令牌');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/api/vscode/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      setUserInfo(response.data);
    } catch (err) {
      setError('获取用户信息失败: ' + (err.response?.data?.error_description || err.message));
    }
    setLoading(false);
  };

  return (
    <Container style={{ marginTop: '2em', maxWidth: '800px' }}>
      <Header as='h2' textAlign='center'>VSCode 认证 API 测试</Header>
      
      <Segment>
        <Header as='h3'>1. 获取授权 URL</Header>
        <Button primary onClick={getAuthUrl} loading={loading}>
          获取授权 URL
        </Button>
        {authUrl && (
          <Form style={{ marginTop: '1em' }}>
            <Form.Field>
              <label>授权 URL:</label>
              <Input 
                value={authUrl} 
                readOnly 
                action={{
                  color: 'blue',
                  content: '在新窗口打开',
                  onClick: () => window.open(authUrl, '_blank')
                }}
              />
            </Form.Field>
          </Form>
        )}
      </Segment>

      <Segment>
        <Header as='h3'>2. 测试回调处理</Header>
        <Message info>
          <p>注意：这是一个模拟测试，实际使用中需要真实的 GitHub OAuth 授权码。</p>
        </Message>
        <Button secondary onClick={testCallback} loading={loading}>
          模拟回调请求
        </Button>
        {accessToken && (
          <Form style={{ marginTop: '1em' }}>
            <Form.Field>
              <label>访问令牌:</label>
              <Input value={accessToken} readOnly />
            </Form.Field>
          </Form>
        )}
      </Segment>

      <Segment>
        <Header as='h3'>3. 获取用户信息</Header>
        <Button color='green' onClick={getUserInfo} loading={loading} disabled={!accessToken}>
          获取用户信息
        </Button>
        {userInfo && (
          <Segment secondary style={{ marginTop: '1em' }}>
            <Header as='h4'>用户信息:</Header>
            <pre>{JSON.stringify(userInfo, null, 2)}</pre>
          </Segment>
        )}
      </Segment>

      {error && (
        <Message negative>
          <Message.Header>错误</Message.Header>
          <p>{error}</p>
        </Message>
      )}
    </Container>
  );
};

export default VSCodeAuthTest;
