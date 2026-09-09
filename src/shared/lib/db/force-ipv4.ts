import dns from 'node:dns';
import net from 'node:net';

// Some environments (WSL2, some CI) blackhole IPv6 to the DB host; Neon serves IPv4 too.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);
