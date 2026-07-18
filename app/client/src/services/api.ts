export class ApiError extends Error {constructor(message:string,public status:number,public code:string){super(message);}}
async function parse<T>(response:Response):Promise<T>{if(response.ok){if(response.status===204)return undefined as T;return response.json() as Promise<T>;}const body=await response.json().catch(()=>({error:{message:'请求失败',code:'UNKNOWN'}}));throw new ApiError(body.error?.message??'请求失败',response.status,body.error?.code??'UNKNOWN');}
export const api={
  get:<T>(url:string)=>fetch(url).then(parse<T>),
  post:<T>(url:string,body?:unknown,headers:Record<string,string>={})=>fetch(url,{method:'POST',headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...headers},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)}).then(parse<T>),
  patch:<T>(url:string,body:unknown)=>fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(parse<T>),
  delete:<T>(url:string,body:unknown)=>fetch(url,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(parse<T>)
};
