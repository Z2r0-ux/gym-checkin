const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
function loadContext(){
  const context=vm.createContext({window:{}});
  for(const file of ["profile","exercises","program","supabase-config"]){
    vm.runInContext(fs.readFileSync(path.join(root,"data",`${file}.js`),"utf8"),context,{filename:`data/${file}.js`});
  }
  return {profile:context.window.APP_PROFILE,program:context.window.TRAINING_PROGRAM,
    library:context.window.EXERCISE_LIBRARY,config:context.window.SUPABASE_CONFIG};
}
module.exports={loadContext,root};
