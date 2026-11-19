import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('compartilha consulta de release entre requisições concorrentes',async()=>{
  vi.resetModules();
  let finish!:(response:Response)=>void;const pending=new Promise<Response>(resolve=>{finish=resolve;});
  const fetch=vi.fn().mockReturnValue(pending);vi.stubGlobal('fetch',fetch);
  const {OvertureService}=await import('../src/services/OvertureService.js');
  const a=new OvertureService().getRelease(),b=new OvertureService().getRelease();
  expect(fetch).toHaveBeenCalledTimes(1);finish(new Response(JSON.stringify({latest:'test-release'}),{status:200}));
  expect(await Promise.all([a,b])).toEqual(['test-release','test-release']);
  expect(await new OvertureService().getRelease()).toBe('test-release');expect(fetch).toHaveBeenCalledTimes(1);
});
it('falha de catálogo não deixa consulta concorrente presa',async()=>{
  vi.resetModules();const fetch=vi.fn().mockResolvedValueOnce(new Response('{}',{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({latest:'recovered'}),{status:200}));vi.stubGlobal('fetch',fetch);
  const {OvertureService}=await import('../src/services/OvertureService.js');
  await expect(new OvertureService().getRelease()).rejects.toThrow('não informou');
  expect(await new OvertureService().getRelease()).toBe('recovered');expect(fetch).toHaveBeenCalledTimes(2);
});
