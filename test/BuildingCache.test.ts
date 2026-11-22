import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {BuildingService} from '../src/services/BuildingService.js';
import {OvertureService,BuildingSourceError} from '../src/services/OvertureService.js';
import type {OvertureBuildingRow} from '../src/interface/BuildingDTO.js';
const area={minLatitude:-23.102,maxLatitude:-23.098,minLongitude:-45.709,maxLongitude:-45.705};
function rectangle(id:string,west:number,east:number,south:number,north:number):OvertureBuildingRow {
  const ring=[[west,south],[east,south],[east,north],[west,north],[west,south]];
  const buffer=Buffer.alloc(13+ring.length*16);buffer.writeUInt8(1);buffer.writeUInt32LE(3,1);buffer.writeUInt32LE(1,5);buffer.writeUInt32LE(ring.length,9);
  ring.forEach(([x,y],i)=>{buffer.writeDoubleLE(x!,13+i*16);buffer.writeDoubleLE(y!,21+i*16);});
  return {id,wkb_hex:buffer.toString('hex'),height:6,num_floors:2,facade_material:null,fonte_original:null,class:null,subtype:null};
}
describe('cache de edificações',()=>{
  beforeEach(()=>{BuildingService.clearCache();vi.spyOn(OvertureService.prototype,'getRelease').mockResolvedValue('test-release');});
  afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();BuildingService.clearCache();});
  it('consulta região menor, sem duplicar prédios que atravessam tiles',async()=>{
    const read=vi.spyOn(OvertureService.prototype,'readBuildings').mockResolvedValue([rectangle('shared',-45.708,-45.707,-23.1005,-23.0995)]);
    const service=new BuildingService();const a=await service.getBuildingsInArea(area);const b=await service.getBuildingsInArea(area);
    expect(a.buildings.map(b=>b.id)).toEqual(['shared']);expect(b.buildings.map(b=>b.id)).toEqual(['shared']);expect(read).toHaveBeenCalledTimes(1);
    const requested=read.mock.calls[0]![1];expect(requested.maxLatitude-requested.minLatitude).toBeLessThanOrEqual(.020001);expect(requested.maxLongitude-requested.minLongitude).toBeLessThanOrEqual(.010001);
  });
  it('preserva prédio com centro fora do tile mas fachada dentro da área',async()=>{
    const read=vi.spyOn(OvertureService.prototype,'readBuildings').mockResolvedValue([rectangle('border',-45.7106,-45.7094,-23.1005,-23.0995)]);
    const service=new BuildingService();const result=await service.getBuildingsInArea({...area,minLongitude:-45.7099,maxLongitude:-45.7097});
    expect(result.buildings.map(b=>b.id)).toEqual(['border']);
    await service.getBuildingsInArea({...area,minLongitude:-45.7098,maxLongitude:-45.7096});expect(read).toHaveBeenCalledTimes(1);
  });
  it('agrega consultas simultâneas e permite repetir depois de falha',async()=>{
    let finish!:(rows:OvertureBuildingRow[])=>void;
    const pending=new Promise<OvertureBuildingRow[]>(resolve=>{finish=resolve;});
    const read=vi.spyOn(OvertureService.prototype,'readBuildings').mockReturnValueOnce(pending);
    const first=new BuildingService().getBuildingsInArea(area);const second=new BuildingService().getBuildingsInArea(area);
    await vi.waitFor(()=>expect(read).toHaveBeenCalledTimes(1));finish([]);await Promise.all([first,second]);
    BuildingService.clearCache();read.mockRejectedValueOnce(new BuildingSourceError('offline')).mockResolvedValueOnce([]);
    await expect(new BuildingService().getBuildingsInArea(area)).rejects.toThrow('offline');
    await expect(new BuildingService().getBuildingsInArea(area)).resolves.toMatchObject({buildings:[]});expect(read).toHaveBeenCalledTimes(3);
  });
  it('reconsulta tiles após vencimento do prazo',async()=>{
    vi.useFakeTimers();const read=vi.spyOn(OvertureService.prototype,'readBuildings').mockResolvedValue([]);
    await new BuildingService().getBuildingsInArea(area);vi.setSystemTime(Date.now()+24*60*60*1000+1);
    await new BuildingService().getBuildingsInArea(area);expect(read).toHaveBeenCalledTimes(2);
  });
});
