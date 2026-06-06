const Docker = require('dockerode');
const docker = new Docker();

async function test() {
  const container = docker.getContainer('c5de6d57655cede3c246dff5faa6ffe83595bd68cad5803060ef3183f54b1efb');
  
  const exec = await container.exec({
    Cmd: ['/bin/bash', '-l'],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  });

  const stream = await exec.start({ hijack: true, stdin: true });
  
  console.log('=== First 3 chunks ===');
  let count = 0;
  stream.on('data', (data) => {
    count++;
    if (count <= 3) {
      console.log(`Chunk ${count}: length=${data.length}`);
      const hex = data.slice(0, Math.min(64, data.length)).toString('hex');
      console.log('  Hex:', hex.match(/.{1,2}/g).join(' '));
      const text = data.toString('utf-8');
      console.log('  Text:', JSON.stringify(text.slice(0, 200)));
      console.log('');
    }
    if (count >= 3) {
      setTimeout(() => { stream.destroy(); process.exit(0); }, 100);
    }
  });
  
  setTimeout(() => {
    stream.destroy();
    process.exit(0);
  }, 2000);
}

test().catch(console.error);
