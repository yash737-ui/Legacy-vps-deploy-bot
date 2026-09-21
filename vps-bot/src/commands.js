import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import db from './database.js';
import { isAdmin, hasVpsAccess } from './vpsManager.js';
import { pingNode, deployVpsContainer, removeVpsContainer, resetContainerPassword } from './nodeManager.js';

const config = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));

export const slashCommands = [
  new SlashCommandBuilder().setName('help').setDescription('List all available commands'),
  new SlashCommandBuilder().setName('status').setDescription('(Admin) Check bot uptime and node reachability'),
  new SlashCommandBuilder().setName('addnode').setDescription('(Admin) Register a new node')
    .addStringOption(o => o.setName('id').setDescription('Unique Node ID').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Node Name').setRequired(true))
    .addStringOption(o => o.setName('host').setDescription('Hostname or localhost').setRequired(true)),
  new SlashCommandBuilder().setName('listnodes').setDescription('(Admin) List all registered nodes'),
  new SlashCommandBuilder().setName('removenode').setDescription('(Admin) Remove a registered node')
    .addStringOption(o => o.setName('id').setDescription('Node ID').setRequired(true)),
  new SlashCommandBuilder().setName('checknodes').setDescription('(Admin) Ping all registered nodes'),
  new SlashCommandBuilder().setName('checkssh').setDescription('Verify VPS SSH accessibility')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true)),
  new SlashCommandBuilder().setName('suspendnode').setDescription('(Admin) Suspend a node')
    .addStringOption(o => o.setName('id').setDescription('Node ID').setRequired(true)),
  new SlashCommandBuilder().setName('unsuspendnode').setDescription('(Admin) Lift a suspension on a node')
    .addStringOption(o => o.setName('id').setDescription('Node ID').setRequired(true)),
  new SlashCommandBuilder().setName('addadmin').setDescription('(Admin) Grant bot admin access')
    .addUserOption(o => o.setName('user').setDescription('Target User').setRequired(true)),
  new SlashCommandBuilder().setName('removeadmin').setDescription('(Admin) Revoke bot admin access')
    .addUserOption(o => o.setName('user').setDescription('Target User').setRequired(true)),
  new SlashCommandBuilder().setName('listadmins').setDescription('(Admin) List all bot admins'),
  new SlashCommandBuilder().setName('createvps').setDescription('(Admin) Provision a VPS for a user')
    .addStringOption(o => o.setName('nodeid').setDescription('Node ID').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('VPS Owner').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('VPS Name').setRequired(true)),
  new SlashCommandBuilder().setName('autoexpiry').setDescription('(Admin) Toggle auto-expiry suspension')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true))
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable or Disable').setRequired(true)),
  new SlashCommandBuilder().setName('renew').setDescription('Extend VPS expiry date')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true)),
  new SlashCommandBuilder().setName('deletevps').setDescription('(Admin) Permanently delete a VPS')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true)),
  new SlashCommandBuilder().setName('listvps').setDescription('List your VPS instances (or all if Admin)'),
  new SlashCommandBuilder().setName('transfer').setDescription('(Admin) Transfer VPS ownership')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true))
    .addUserOption(o => o.setName('newowner').setDescription('New Owner').setRequired(true)),
  new SlashCommandBuilder().setName('sharewith').setDescription('Share VPS access with another user')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('unshare').setDescription('Revoke shared access from a user')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('manage').setDescription('Open VPS management panel')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true)),
  new SlashCommandBuilder().setName('ssh').setDescription('View SSH connection parameters')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true)),
  new SlashCommandBuilder().setName('sshx').setDescription('Start an sshx.io web terminal session')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true)),
  new SlashCommandBuilder().setName('regenpassword').setDescription('Regenerate root password for VPS')
    .addStringOption(o => o.setName('vpsid').setDescription('VPS ID').setRequired(true))
].map(c => c.toJSON());

export async function executeCommand(cmd, args, context) {
  const { user, reply, isSlash, client } = context;
  const admin = isAdmin(user.id);

  switch (cmd) {
    case 'help': {
      const embed = new EmbedBuilder()
        .setTitle(`📖 ${config.hostingName} — Command Handbook`)
        .setColor(0x5865f2)
        .setDescription(`Powered by **${config.botName}**\nCommands: \`/command\` ya \`${config.prefix}command\``)
        .addFields(
          { name: '⚙️ User Controls', value: '`help`, `listvps`, `manage`, `ssh`, `sshx`, `regenpassword`, `checkssh`, `renew`, `sharewith`, `unshare`' },
          { name: '🛡️ Admin Controls', value: '`status`, `addnode`, `listnodes`, `removenode`, `checknodes`, `suspendnode`, `unsuspendnode`, `addadmin`, `removeadmin`, `listadmins`, `createvps`, `deletevps`, `transfer`, `autoexpiry`' }
        )
        .setFooter({ text: `${config.hostingName} • High Performance Cloud` });
      return reply({ embeds: [embed] });
    }

    case 'status': {
      if (!admin) return reply('❌ Sirf bot admins ke liye allow hai.');
      const nodes = db.prepare('SELECT * FROM nodes').all();
      let nodeStatus = '';
      for (const n of nodes) {
        const up = await pingNode(n.host, n.port);
        nodeStatus += `• **${n.name}** (${n.host}):${up ? '🟢 Online' : '🔴 Offline'}\n`;
      }
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${config.hostingName} Status`)
        .setColor(0x2ecc71)
        .addFields(
          { name: 'Uptime', value: `${(process.uptime() / 60).toFixed(1)} mins`, inline: true },
          { name: 'Discord Ping', value: `${client.ws.ping} ms`, inline: true },
          { name: 'Nodes Status', value: nodeStatus || 'Koi node register nahi hai.' }
        );
      return reply({ embeds: [embed] });
    }

    case 'addnode': {
      if (!admin) return reply('❌ Admin access required.');
      const id = args.id || args[0];
      const name = args.name || args[1];
      const host = args.host || args[2];
      if (!id || !name || !host) return reply(`Sahi format: \`${config.prefix}addnode <id> <name> <host>\``);

      db.prepare('INSERT OR REPLACE INTO nodes (id, name, host) VALUES (?, ?, ?)').run(id, name, host);
      return reply(`✅ Node **${name}** (\`${id}\`) add ho gaya hai host \`${host}\` ke sath.`);
    }

    case 'listnodes': {
      if (!admin) return reply('❌ Admin access required.');
      const nodes = db.prepare('SELECT * FROM nodes').all();
      if (!nodes.length) return reply('Koi node registered nahi hai.');
      const out = nodes.map(n => `• **${n.name}** | ID: \`${n.id}\` | Host: \`${n.host}\` | Status: ${n.isSuspended ? '⚠️ Suspended' : 'Active'}`).join('\n');
      return reply({ embeds: [new EmbedBuilder().setTitle(`${config.hostingName} Nodes`).setDescription(out).setColor(0x5865f2)] });
    }

    case 'removenode': {
      if (!admin) return reply('❌ Admin access required.');
      const id = args.id || args[0];
      db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
      return reply(`🗑️ Node \`${id}\` remove ho gaya.`);
    }

    case 'checknodes': {
      if (!admin) return reply('❌ Admin access required.');
      const nodes = db.prepare('SELECT * FROM nodes').all();
      const results = await Promise.all(nodes.map(async n => {
        const ok = await pingNode(n.host, n.port);
        return `• ${n.name}:${ok ? '🟢 Online' : '🔴 Unreachable'}`;
      }));
      return reply(results.join('\n') || 'Koi node nahi mila.');
    }

    case 'suspendnode':
    case 'unsuspendnode': {
      if (!admin) return reply('❌ Admin access required.');
      const id = args.id || args[0];
      const state = cmd === 'suspendnode' ? 1 : 0;
      db.prepare('UPDATE nodes SET isSuspended = ? WHERE id = ?').run(state, id);
      return reply(`Node \`${id}\` ka status ab: ${state ? 'Suspended' : 'Active'} hai.`);
    }

    case 'addadmin': {
      if (!admin) return reply('❌ Admin access required.');
      const target = isSlash ? args.user?.id : args[0]?.replace(/[<@!>]/g, '');
      if (!target) return reply('User mention karein ya ID dein.');
      db.prepare('INSERT OR IGNORE INTO admins (userId) VALUES (?)').run(target);
      return reply(`✅ <@${target}> ko bot admin bana diya gaya hai.`);
    }

    case 'removeadmin': {
      if (!admin) return reply('❌ Admin access required.');
      const target = isSlash ? args.user?.id : args[0]?.replace(/[<@!>]/g, '');
      db.prepare('DELETE FROM admins WHERE userId = ?').run(target);
      return reply(`<@${target}> ka admin access hata diya gaya.`);
    }

    case 'listadmins': {
      if (!admin) return reply('❌ Admin access required.');
      const list = db.prepare('SELECT userId FROM admins').all();
      return reply(list.map(a => `<@${a.userId}>`).join('\n') || 'Koi custom admin nahi hai.');
    }

    case 'createvps': {
      if (!admin) return reply('❌ Admin access required.');
      const nodeId = args.nodeid || args[0];
      const targetUser = isSlash ? args.user?.id : args[1]?.replace(/[<@!>]/g, '');
      const vpsName = (args.name || args[2] || 'server').toLowerCase().replace(/[^a-z0-9]/g, '');

      const node = db.prepare('SELECT * FROM nodes WHERE id = ? AND isSuspended = 0').get(nodeId);
      if (!node) return reply('Node nahi mila ya fir suspend hai.');

      const vpsId = crypto.randomBytes(4).toString('hex');
      try {
        const instance = await deployVpsContainer(node, vpsId, vpsName);
        const expiresAt = Date.now() + config.defaultExpiryDays * 86400000;

        db.prepare('INSERT INTO vps (id, name, ownerId, nodeId, port, password, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(vpsId, vpsName, targetUser, node.id, instance.assignedPort, instance.rootPassword, expiresAt);

        const embed = new EmbedBuilder()
          .setTitle(`⚡ ${config.hostingName} — VPS Ready`)
          .setColor(0x2ecc71)
          .addFields(
            { name: 'Owner', value: `<@${targetUser}>`, inline: true },
            { name: 'VPS ID', value: `\`${vpsId}\``, inline: true },
            { name: 'SSH Port', value: `\`${instance.assignedPort}\``, inline: true },
            { name: 'Root Password', value: `||${instance.rootPassword}||`, inline: true },
            { name: 'Expiry Date', value: `<t:${Math.floor(expiresAt / 1000)}:R>` }
          );
        return reply({ embeds: [embed] });
      } catch (err) {
        return reply(`Deploy karte waqt error aaya: ${err.message}`);
      }
    }

    case 'renew': {
      const vpsId = args.vpsid || args[0];
      const vps = db.prepare('SELECT * FROM vps WHERE id = ?').get(vpsId);
      if (!vps) return reply('VPS nahi mila.');
      if (!admin && vps.ownerId !== user.id) return reply('Yeh VPS aapka nahi hai.');

      const newExpiry = Math.max(vps.expiresAt, Date.now()) + config.defaultExpiryDays * 86400000;
      db.prepare('UPDATE vps SET expiresAt = ?, isSuspended = 0 WHERE id = ?').run(newExpiry, vpsId);
      return reply(`✅ VPS \`${vpsId}\` renew ho gaya hai: <t:${Math.floor(newExpiry / 1000)}:F> tak.`);
    }

    case 'deletevps': {
      if (!admin) return reply('❌ Admin access required.');
      const vpsId = args.vpsid || args[0];
      const vps = db.prepare('SELECT * FROM vps WHERE id = ?').get(vpsId);
      if (!vps) return reply('VPS nahi mila.');

      await removeVpsContainer(vps.id, vps.name);
      db.prepare('DELETE FROM vps WHERE id = ?').run(vpsId);
      return reply(`🗑️ VPS \`${vpsId}\` permanently delete ho gaya.`);
    }

    case 'listvps': {
      const rows = admin
        ? db.prepare('SELECT * FROM vps').all()
        : db.prepare('SELECT * FROM vps WHERE ownerId = ?').all(user.id);

      if (!rows.length) return reply('Aapka koi active VPS nahi mila.');
      const list = rows.map(v => `• **${v.name}** (\`${v.id}\`) | Owner: <@${v.ownerId}> | Port: \`${v.port}\` | ${v.isSuspended ? '🔴 Suspended' : '🟢 Active'}`).join('\n');
      return reply({ embeds: [new EmbedBuilder().setTitle(`${config.hostingName} VPS Instances`).setDescription(list).setColor(0x5865f2)] });
    }

    case 'ssh': {
      const vpsId = args.vpsid || args[0];
      const vps = db.prepare('SELECT * FROM vps WHERE id = ?').get(vpsId);
      if (!vps || !hasVpsAccess(vps, user.id)) return reply('Access denied ya galat VPS ID.');

      const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(vps.nodeId);
      const embed = new EmbedBuilder()
        .setTitle(`🔑 SSH Access: ${vps.name}`)
        .addFields(
          { name: 'Host', value: `\`${node?.host || 'localhost'}\``, inline: true },
          { name: 'Port', value: `\`${vps.port}\``, inline: true },
          { name: 'User', value: '`root`', inline: true },
          { name: 'Password', value: `||${vps.password}||` },
          { name: 'Command', value: `\`\`\`bash\nssh root@${node?.host || 'localhost'} -p ${vps.port}\n\`\`\`` }
        );
      return reply({ embeds: [embed], ephemeral: true });
    }

    case 'checkssh': {
      const vpsId = args.vpsid || args[0];
      const vps = db.prepare('SELECT * FROM vps WHERE id = ?').get(vpsId);
      if (!vps) return reply('VPS nahi mila.');

      const isOpen = await pingNode('127.0.0.1', vps.port);
      return reply(`SSH Port \`${vps.port}\`: ${isOpen ? '🟢 Online & Ready' : '🔴 Unreachable'}`);
    }

    case 'regenpassword': {
      const vpsId = args.vpsid || args[0];
      const vps = db.prepare('SELECT * FROM vps WHERE id = ?').get(vpsId);
      if (!vps || !hasVpsAccess(vps, user.id)) return reply('Access denied.');

      const newPass = crypto.randomBytes(6).toString('hex');
      await resetContainerPassword(vps.id, vps.name, newPass);
      db.prepare('UPDATE vps SET password = ? WHERE id = ?').run(newPass, vpsId);
      return reply({ content: `✅ Naya password generate ho gaya: ||${newPass}||`, ephemeral: true });
    }

    case 'sharewith':
    case 'unshare': {
      const vpsId = args.vpsid || args[0];
      const targetUser = isSlash ? args.user?.id : args[1]?.replace(/[<@!>]/g, '');
      const vps = db.prepare('SELECT * FROM vps WHERE id = ? AND ownerId = ?').get(vpsId, user.id);
      if (!vps) return reply('VPS nahi mila ya aap owner nahi ho.');

      let shared = JSON.parse(vps.sharedUsers || '[]');
      if (cmd === 'sharewith') {
        if (!shared.includes(targetUser)) shared.push(targetUser);
      } else {
        shared = shared.filter(id => id !== targetUser);
      }

      db.prepare('UPDATE vps SET sharedUsers = ? WHERE id = ?').run(JSON.stringify(shared), vpsId);
      return reply(`VPS \`${vpsId}\` ke permissions update ho gaye.`);
    }

    case 'manage': {
      const vpsId = args.vpsid || args[0];
      const vps = db.prepare('SELECT * FROM vps WHERE id = ?').get(vpsId);
      if (!vps || !hasVpsAccess(vps, user.id)) return reply('Access denied ya galat VPS ID.');

      const embed = new EmbedBuilder()
        .setTitle(`🎛️ VPS Manager: ${vps.name}`)
        .setColor(0x00aaff)
        .addFields(
          { name: 'ID', value: `\`${vps.id}\``, inline: true },
          { name: 'Node', value: `\`${vps.nodeId}\``, inline: true },
          { name: 'Port', value: `\`${vps.port}\``, inline: true },
          { name: 'Auto Expiry', value: vps.autoExpiry ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Expires', value: `<t:${Math.floor(vps.expiresAt / 1000)}:R>`, inline: true }
        );
      return reply({ embeds: [embed] });
    }

    case 'sshx': {
      const vpsId = args.vpsid || args[0];
      const vps = db.prepare('SELECT * FROM vps WHERE id = ?').get(vpsId);
      if (!vps || !hasVpsAccess(vps, user.id)) return reply('Access denied.');
      return reply({ content: `Apne server ke terminal me ye run karein web shell ke liye:\n\`\`\`bash\ncurl -sSf https://sshx.io/get | sh -s run\n\`\`\``, ephemeral: true });
    }

    case 'transfer': {
      if (!admin) return reply('❌ Admin access required.');
      const vpsId = args.vpsid || args[0];
      const targetUser = isSlash ? args.newowner?.id : args[1]?.replace(/[<@!>]/g, '');
      db.prepare('UPDATE vps SET ownerId = ? WHERE id = ?').run(targetUser, vpsId);
      return reply(`VPS \`${vpsId}\` ab <@${targetUser}> ke naam ho gaya hai.`);
    }

    case 'autoexpiry': {
      if (!admin) return reply('❌ Admin access required.');
      const vpsId = args.vpsid || args[0];
      const enabled = isSlash ? args.enabled : args[1] === 'true';
      db.prepare('UPDATE vps SET autoExpiry = ? WHERE id = ?').run(enabled ? 1 : 0, vpsId);
      return reply(`Auto-expiry \`${vpsId}\` ke liye ab: ${enabled ? 'Enabled' : 'Disabled'} hai.`);
    }

    default:
      return reply('Command samajh nahi aayi.');
  }
}
