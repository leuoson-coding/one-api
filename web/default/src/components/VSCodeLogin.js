import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Header, Segment, Button, Message, Icon } from 'semantic-ui-react';

const VSCodeLogin = () => {
  const [searchParams] = useSearchParams();
  const [authCode, setAuthCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    if (errorParam) {
      setError(errorDescription || errorParam);
      setLoading(false);
    } else if (code) {
      setAuthCode(code);
      setLoading(false);
    } else {
      setError('未收到授权码');
      setLoading(false);
    }
  }, [searchParams]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(authCode);
      // 简单的成功提示
      const button = document.getElementById('copy-button');
      const originalText = button.textContent;
      button.textContent = '已复制!';
      button.className = button.className.replace('blue', 'green');
      
      setTimeout(() => {
        button.textContent = originalText;
        button.className = button.className.replace('green', 'blue');
      }, 2000);
    } catch (err) {
      console.error('复制失败:', err);
      // 降级方案：选中文本
      const codeElement = document.getElementById('auth-code');
      if (codeElement) {
        const range = document.createRange();
        range.selectNode(codeElement);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
    }
  };

  if (loading) {
    return (
      <Container style={{ marginTop: '2em' }}>
        <Segment basic textAlign='center'>
          <Icon loading name='spinner' size='large' />
          <Header as='h3'>正在处理授权...</Header>
        </Segment>
      </Container>
    );
  }

  return (
    <Container style={{ marginTop: '2em', maxWidth: '600px' }}>
      <Segment>
        <Header as='h2' textAlign='center' color='blue'>
          <Icon name='code' />
          VSCode 插件授权
        </Header>
        
        {error ? (
          <Message negative>
            <Message.Header>授权失败</Message.Header>
            <p>{error}</p>
            <p>请返回 VSCode 重新尝试授权。</p>
          </Message>
        ) : (
          <>
            <Message positive>
              <Message.Header>授权成功！</Message.Header>
              <p>请复制以下授权码并粘贴到 VSCode 插件中：</p>
            </Message>
            
            <Segment secondary>
              <Header as='h4'>授权码：</Header>
              <div style={{ 
                background: '#f8f8f8', 
                padding: '15px', 
                margin: '10px 0',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                wordBreak: 'break-all',
                userSelect: 'all'
              }}>
                <span id="auth-code">{authCode}</span>
              </div>
              
              <Button 
                id="copy-button"
                primary 
                fluid 
                onClick={copyToClipboard}
                icon='copy'
                content='复制授权码'
              />
            </Segment>
            
            <Message info>
              <Message.Header>使用说明：</Message.Header>
              <Message.List>
                <Message.Item>复制上面的授权码</Message.Item>
                <Message.Item>返回 VSCode 插件</Message.Item>
                <Message.Item>将授权码粘贴到插件的输入框中</Message.Item>
                <Message.Item>完成授权流程</Message.Item>
              </Message.List>
            </Message>
          </>
        )}
      </Segment>
    </Container>
  );
};

export default VSCodeLogin;
