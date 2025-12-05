export async function onRequestPost(context) {
  try {
    const { prompt } = await context.request.json();

    if (!prompt) {
      return new Response("Missing prompt", { status: 400 });
    }

    // --- 第1步：使用 Llama 3 进行翻译和润色 ---
    // 这是一个专门用于 Stable Diffusion 的 System Prompt
    const systemPrompt = `
      You are a professional prompt engineer for Stable Diffusion. 
      Your task is to translate the user's input into English (if it's not already) and enhance it with artistic details.
      
      Rules:
      1. Translate to English.
      2. Add keywords for quality (e.g., "highly detailed", "8k", "cinematic lighting", "masterpiece").
      3. Keep the meaning of the original input.
      4. Output ONLY the final prompt string. Do not add explanations or quotes.
    `;

    const translationResponse = await context.env.AI.run(
      "@cf/meta/llama-3-8b-instruct", // 使用 Llama 3 8B 模型
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      }
    );

    // 获取翻译后的英文提示词
    const englishPrompt = translationResponse.response;
    console.log(`Original: ${prompt} -> Translated: ${englishPrompt}`); // 可以在后台日志看到

    // --- 第2步：使用 SDXL Lightning 生成图片 ---
    // const imageResponse = await context.env.AI.run(
    //   "@cf/bytedance/stable-diffusion-xl-lightning",
    //   {
    //     prompt: englishPrompt, // 使用优化后的提示词
    //     num_steps: 4, 
    //   }
    // );

    // 新代码 (使用 Flux.1 Schnell):
    const imageResponse = await context.env.AI.run(
      "@cf/black-forest-labs/flux-1-schnell", 
      {
        prompt: englishPrompt,
        num_steps: 4, // Flux Schnell 官方建议 4 步即可出高质量图
      }
    );

    // --- 第3步：处理图片数据 ---
    const binary = await new Response(imageResponse).arrayBuffer();
    const base64String = btoa(
      new Uint8Array(binary).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const dataURI = `data:image/png;base64,${base64String}`;

    // 返回图片以及翻译后的提示词，方便前端展示
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