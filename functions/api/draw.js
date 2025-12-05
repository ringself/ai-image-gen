// 1. 引入 Buffer (必须放在文件最顶部)
import { Buffer } from 'node:buffer';

export async function onRequestPost(context) {
  try {
    const { prompt, width, height } = await context.request.json();

    if (!prompt) {
      return new Response("Missing prompt", { status: 400 });
    }

    // 设置默认值
    const imgWidth = width || 512;
    const imgHeight = height || 512;

    // --- Llama 3 翻译 ---
    const systemPrompt = `
      You are a professional prompt engineer. 
      Translate user input to English. Output ONLY the final prompt.
    `;
    const translationResponse = await context.env.AI.run(
      "@cf/meta/llama-3-8b-instruct", 
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      }
    );
    const englishPrompt = translationResponse.response;

    // --- Flux.1 绘图 ---
    const imageResponse = await context.env.AI.run(
      "@cf/black-forest-labs/flux-1-schnell", 
      {
        prompt: englishPrompt,
        num_steps: 4, 
        width: imgWidth,
        height: imgHeight
      }
    );

    // --- 图片数据处理 (性能优化版) ---
    let base64String;

    // 情况 A: Flux 模型直接返回 Base64 字符串
    if (imageResponse.image) {
        base64String = imageResponse.image;
    } 
    // 情况 B: SDXL 或其他模型返回二进制流 (Stream)
    else {
        // 1. 读取流到 ArrayBuffer
        const binary = await new Response(imageResponse).arrayBuffer();
        
        // 2. [优化点] 使用 Node.js Buffer API 极速转换
        // 这里的速度比之前的 reduce 拼接快几百倍，且不占用额外内存
        base64String = Buffer.from(binary).toString('base64');
    }

    const dataURI = `data:image/png;base64,${base64String}`;

    return new Response(JSON.stringify({ 
      image: dataURI,
      translatedPrompt: englishPrompt 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    // 打印详细错误方便排查
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), { status: 500 });
  }
}