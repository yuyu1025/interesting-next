import { callOpenAiApiStream } from '../api/ai-content/openai';
import { headers } from 'next/headers';

interface AIContentPageProps {
  path: string;
}

export default async function AIContentPage({ path }: AIContentPageProps) {
  try {
    // 获取请求头信息
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || '';
    
    // 调用AI API生成内容
    const response = await callOpenAiApiStream(path, userAgent);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    // 读取流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let htmlContent = '';
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                htmlContent += content;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }
    
    // 清理HTML内容
    const cleanHtml = htmlContent.replace(/^```html\s*|```$/g, '').trim();
    
    // 直接返回HTML内容
    return (
      <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    );
    
  } catch (error) {
    console.error('生成页面内容时发生错误:', error);
    
    const isHomePage = path === '/';
    
    // 返回错误页面
    return (
      <div style={{ 
        fontFamily: 'sans-serif', 
        backgroundColor: '#fdd', 
        color: '#a00',
        textAlign: 'center',
        padding: '50px'
      }}>
        <h1>500 - 服务器内部错误</h1>
        <p>{isHomePage ? '生成首页内容时发生错误' : '生成页面内容时发生错误'}</p>
        <p>{(error as Error).message}</p>
        <a href="/">{isHomePage ? '刷新页面' : '返回首页'}</a>
      </div>
    );
  }
}