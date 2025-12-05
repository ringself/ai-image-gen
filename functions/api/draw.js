export async function onRequestPost(context) {
  try {
    const { prompt } = await context.request.json();

    if (!prompt) {
      return new Response("Missing prompt", { status: 400 });
    }

    // --- 第1步：Llama 3 翻译 (代码保持不变) ---
    const systemPrompt = `
      You are a professional prompt engineer for Stable Diffusion. 
      Your task is to translate the user's input into English (if it's not already) and enhance it with artistic details.
      Output ONLY the final prompt string.
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

    // --- 第2步：Flux.1 绘图 ---
    const modelId = "@cf/black-forest-labs/flux-1-schnell"; 
    // const modelId = "@cf/bytedance/stable-diffusion-xl-lightning"; // 也可以随时切回 SDXL

    const imageResponse = await context.env.AI.run(
      modelId,
      {
        prompt: englishPrompt,
        num_steps: 4, 
      }
    );

    // --- 第3步：智能处理图片数据 (修复核心) ---
    let base64String;

    // 🔍 关键判断：Flux 模型直接返回 image 字段，不需要转换
    if (imageResponse.image) {
        base64String = imageResponse.image;
    } 
    // 🔍 兼容旧模型：如果是二进制流，则手动转换
    else {
        const binary = await new Response(imageResponse).arrayBuffer();
        base64String = btoa(
          new Uint8Array(binary).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
    }

    const dataURI = `data:image/png;base64,${base64String}`;

    // --- 第4步：返回 ---
    return new Response(JSON.stringify({ 
      image: dataURI,
      translatedPrompt: englishPrompt 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}