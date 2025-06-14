import { callOpenAiApiStream } from "../ai-content/openai";
import { NextRequest, NextResponse } from 'next/server';

/**
 * Handles GET requests for dynamic slug routes with streaming response
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }
): Promise<NextResponse> {
    try {
        // 从请求中获取 URL 和 User-Agent
        const url = request.nextUrl.pathname;
        const userAgent = request.headers.get('user-agent') || '';
        
        // 调用OpenAI流式API
        const response = await callOpenAiApiStream(url, userAgent);

        // 处理HTTP错误响应
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API请求失败，状态码: ${response.status}，错误信息: ${errorBody}`);
        }

        // 创建流式响应
        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let htmlContent = '';
                
                if (!reader) {
                    controller.close();
                    return;
                }

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done) {
                            // 流结束，处理完整的HTML内容
                            const finalHtml = extractContentFromStreamResponse(htmlContent);
                            if (finalHtml) {
                                // 如果还有剩余内容，发送出去
                                const remaining = finalHtml.slice(htmlContent.length);
                                if (remaining) {
                                    controller.enqueue(new TextEncoder().encode(remaining));
                                }
                            }
                            controller.close();
                            break;
                        }

                        // 解析SSE数据
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');
                        
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6);
                                if (data === '[DONE]') {
                                    continue;
                                }
                                
                                try {
                                    const parsed = JSON.parse(data);
                                    const content = parsed.choices?.[0]?.delta?.content;
                                    
                                    if (content) {
                                        htmlContent += content;
                                        // 实时发送内容块
                                        controller.enqueue(new TextEncoder().encode(content));
                                    }
                                } catch (e) {
                                    // 忽略解析错误
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('流式处理错误:', error);
                    controller.error(error);
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            },
        });

    } catch (error) {
        // 记录错误并返回错误页面
        console.error('调用OpenAI API时发生错误:', error);
        const errorHtml = generateErrorHtml(
            "500 - 服务器内部错误",
            "调用AI服务时发生错误。",
            (error as Error).message,
            "#fdd",
            "#a00"
        );
        return new NextResponse(errorHtml, {
            status: 500,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        });
    }
}

/**
 * Extracts and cleans content from streaming response
 * @param {string} content - Raw streaming content
 * @returns {string|null} Cleaned HTML content or null if invalid
 */
function extractContentFromStreamResponse(content: string): string | null {
    if (!content) return null;
    
    // Remove markdown code block markers if present
    let htmlContent = content.replace(/^```html\s*|```$/g, '').trim();
    return htmlContent || null;
}

/**
 * Validates and extracts content from OpenAI API response
 * @param {object} result - API response object
 * @returns {string|null} Extracted HTML content or null if invalid
 */
function extractContentFromResponse(result: any): string | null {
    if (result.choices && result.choices.length > 0 &&
        result.choices[0].message && result.choices[0].message.content) {

        let htmlContent = result.choices[0].message.content;
        // Remove markdown code block markers if present
        htmlContent = htmlContent.replace(/^```html\s*|```$/g, '').trim();
        return htmlContent;
    }

    return null;
}
/**
 * Generates error HTML template
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @param {string} details - Additional error details
 * @param {string} bgColor - Background color
 * @param {string} textColor - Text color
 * @returns {string} HTML error page
 */
function generateErrorHtml(
    title: string,
    message: string,
    details: string = '',
    bgColor: string = '#f0f0f0',
    textColor: string = '#333'
): string {
    const detailsHtml = details ? `<p>${details}</p>` : '';

    return `<html><head><meta charset="utf-8"></head><body style="font-family: sans-serif; background-color: ${bgColor}; color: ${textColor};"><div style="text-align: center; padding: 50px;"><h1>${title}</h1><p>${message}</p>${detailsHtml}<a href="/public">返回首页</a></div></body></html>`;
}
