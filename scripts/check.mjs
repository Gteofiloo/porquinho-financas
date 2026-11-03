import fs from 'node:fs';import vm from 'node:vm';import {execFileSync} from 'node:child_process';
for(const dir of ['api','lib','public'])for(const file of fs.readdirSync(dir))if(file.endsWith('.js'))execFileSync(process.execPath,['--check',`${dir}/${file}`]);
const html=fs.readFileSync('public/index.html','utf8');
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
if(html.includes('localStorage'))throw new Error('Dados da conta nao devem usar localStorage.');
if(!html.includes('/nuvem.js'))throw new Error('Integracao ausente.');
console.log('HTML e scripts verificados.');
