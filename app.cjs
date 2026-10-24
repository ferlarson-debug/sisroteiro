// Startup CommonJS para cPanel/Passenger; a aplicação continua em módulos ES.
const path=require('node:path');
try{process.loadEnvFile(path.join(__dirname,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
import('./server/index.mjs').catch(error=>{console.error('Falha ao iniciar Sisroteiro:',error.code||error.name);process.exitCode=1;});
