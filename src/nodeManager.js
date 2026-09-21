import Docker from 'dockerode';
import net from 'node:net';
import crypto from 'node:crypto';

const localDocker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function pingNode(host, port = 22) {
  if (host === 'localhost' || host === '127.0.0.1') {
    return new Promise((resolve) => {
      localDocker.ping((err) => resolve(!err));
    });
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function deployVpsContainer(node, vpsId, name) {
  if (node.host !== 'localhost' && node.host !== '127.0.0.1') {
    throw new Error('Remote node execution ke liye remote Docker API setup chahiye.');
  }

  const assignedPort = Math.floor(20000 + Math.random() * 10000);
  const rootPassword = crypto.randomBytes(6).toString('hex');
  const containerName = `legacy-${vpsId}-${name}`;

  const container = await localDocker.createContainer({
    Image: 'ubuntu:22.04',
    name: containerName,
    Hostname: name,
    Tty: true,
    OpenStdin: true,
    Cmd: [
      '/bin/bash',
      '-c',
      `apt-get update && apt-get install -y openssh-server sudo curl && ` +
      `echo "root:${rootPassword}" | chpasswd && ` +
      `sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && ` +
      `mkdir -p /var/run/sshd && /usr/sbin/sshd -D`
    ],
    HostConfig: {
      PortBindings: { '22/tcp': [{ HostPort: `${assignedPort}` }] },
      RestartPolicy: { Name: 'unless-stopped' }
    }
  });

  await container.start();
  return { assignedPort, rootPassword };
}

export async function removeVpsContainer(vpsId, name) {
  const containerName = `legacy-${vpsId}-${name}`;
  try {
    const container = localDocker.getContainer(containerName);
    await container.stop({ t: 2 }).catch(() => {});
    await container.remove().catch(() => {});
  } catch (err) {}
}

export async function resetContainerPassword(vpsId, name, newPass) {
  const container = localDocker.getContainer(`legacy-${vpsId}-${name}`);
  const exec = await container.exec({
    Cmd: ['/bin/bash', '-c', `echo "root:${newPass}" | chpasswd`],
    AttachStdout: true,
    AttachStderr: true
  });
  await exec.start({});
      }
