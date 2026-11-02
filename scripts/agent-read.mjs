import fs from "node:fs/promises";
import contextModule from "./agent-context.cjs";
import serializer from "../agent-data.js";
import cloudModule from "./agent-cloud.cjs";
const context=contextModule.loadContext();
try{
  const [command,file]=process.argv.slice(2);
  let result;
  if(command==="plan")result=serializer.buildPlan(context.profile,context.program,context.library);
  else if(command==="cloud")result=await cloudModule.readCloud({...context,accessToken:process.env.GYM_ACCESS_TOKEN});
  else if(command==="file"&&file){
    const data=JSON.parse(await fs.readFile(file,"utf8"));
    if(data.kind==="gym-checkin.snapshot"&&data.schemaVersion===1&&data.plan&&Array.isArray(data.history))result=data;
    else{
      if(!data.days||typeof data.days!=="object"||Array.isArray(data.days)||!Array.isArray(data.history))throw new Error("Expected an agent snapshot or a training backup with days and history");
      result=serializer.buildSnapshot({...context,state:data,source:{kind:"export-file",ready:true}});
    }
  }else throw new Error("Usage: node scripts/agent-read.mjs plan | cloud | file <backup.json>");
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
}catch(error){console.error(error.message);process.exitCode=1;}
