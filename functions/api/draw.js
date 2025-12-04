export async function onRequestPost(context) {
  try {
    // 1. 获取前端传来的提示词
    const { prompt } = await context.request.json();

    if (!prompt) {
      return new Response("Missing prompt", { status: 400 });
    }

    // 2. 调用 Workers AI 模型
    // 使用 SDXL Lightning 模型，因为它只需 4 步推理，速度极快
    const response = await context.env.AI.run(
      "@cf/bytedance/stable-diffusion-xl-lightning",
      {
        prompt: prompt,
        num_steps: 4, // Lightning 模型建议 4-8 步
      }
    );

    // 3. 处理图片数据
    // AI 返回的是二进制流 (Binary Stream)。为了方便前端显示，
    // 我们将其转换为 Base64 字符串。
    const binary = await new Response(response).arrayBuffer();
    const base64String = btoa(
      new Uint8Array(binary).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const dataURI = `data:image/png;base64,${base64String}`;

    // 4. 返回给前端
    return new Response(JSON.stringify({ image: dataURI }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}