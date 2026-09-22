import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { InMemoryCredentialStore, createAssistantMessageEventStream } from '@earendil-works/pi-ai';
export async function provider(responses) {
  let requests = 0;
  const runtime = await ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  runtime.registerProvider('commandcode', { baseUrl: 'https://api.commandcode.ai/provider/v1', api: 'openai-completions', apiKey: 'isolated-fixture',
    models: ['deepseek/deepseek-v4.1-flash','z-ai/glm-5.3-flash'].map(id => ({ id, name: id, reasoning: false, input: ['text'], cost: { input:0,output:0,cacheRead:0,cacheWrite:0 }, contextWindow:128000,maxTokens:8192 })),
    streamSimple(model, context, options) {
      const stream = createAssistantMessageEventStream();
      const index = requests++;
      queueMicrotask(async () => {
        try {
          const content = typeof responses[index] === 'function' ? await responses[index](context, options) : responses[index];
          if (!content) throw new Error('Unexpected extra provider request');
          const message = { role:'assistant', content, api:'openai-completions', provider:'commandcode', model:model.id,
            usage:{input:10,output:5,cacheRead:0,cacheWrite:0,totalTokens:15,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},
            stopReason:content.some(c=>c.type==='toolCall')?'toolUse':'stop', timestamp:Date.now() };
          stream.push({type:'done',reason:message.stopReason,message}); stream.end(message);
        } catch (error) {
          const message = { role:'assistant', content:[],api:'openai-completions',provider:'commandcode',model:model.id,usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'error',errorMessage:error.message,timestamp:Date.now() };
          stream.push({type:'error',reason:'error',error:message});stream.end(message);
        }
      }); return stream;
    }
  });
  return { config: { apiKey:'isolated-fixture', baseUrl:'https://api.commandcode.ai/provider/v1', modelRuntime:runtime }, requests:()=>requests };
}
