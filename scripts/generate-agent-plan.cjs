const fs=require("node:fs");
const path=require("node:path");
const {loadContext,root}=require("./agent-context.cjs");
const {buildPlan}=require("../agent-data.js");
const {profile,program,library}=loadContext();
const output=JSON.stringify(buildPlan(profile,program,library),null,2)+"\n";
const file=path.join(root,"api/v1/plan.json");
if(process.argv.includes("--check")){
  if(!fs.existsSync(file)||fs.readFileSync(file,"utf8")!==output){
    console.error("Public plan is stale. Run: node scripts/generate-agent-plan.cjs");process.exitCode=1;
  }
}else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,output);}
