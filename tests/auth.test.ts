import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {passwordHash,passwordOK,passwordNeedsUpgrade} from '../src/auth.ts';

test('New password hashes use the explicit supported scrypt profile and independent random salts',()=>{
  const password='A long password with café and 🔥',first=passwordHash(password),second=passwordHash(password);
  assert.match(first,/^\$scrypt\$v=1\$N=16384,r=8,p=5\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.notEqual(first,second);assert.notEqual(first.split('$')[4],second.split('$')[4]);
  assert.equal(passwordOK(password,first),true);assert.equal(passwordOK(password,second),true);
  assert.equal(passwordOK(password+'!',first),false);assert.equal(passwordOK('',first),false);
  assert.equal(passwordNeedsUpgrade(first),false);
  const [,algorithm,version,parameters,salt,hash]=first.split('$');
  assert.equal(algorithm,'scrypt');assert.equal(version,'v=1');assert.equal(parameters,'N=16384,r=8,p=5');
  assert.equal(hash,scryptSync(password,salt,64,{N:16384,r:8,p:5,maxmem:32*1024*1024}).toString('hex'));
});

test('Legacy hashes still verify and are marked for upgrade without changing the password',()=>{
  const password='Previously created account password',salt='0123456789abcdef0123456789abcdef';
  // Exactly the original app's hash generation, without the new explicit profile.
  const legacy=salt+':'+scryptSync(password,salt,64).toString('hex');
  assert.equal(passwordOK(password,legacy),true);assert.equal(passwordOK('incorrect',legacy),false);
  assert.equal(passwordNeedsUpgrade(legacy),true);
  const upgraded=passwordHash(password);assert.equal(passwordOK(password,upgraded),true);assert.equal(passwordNeedsUpgrade(upgraded),false);
});

test('Malformed, unsupported or oversized stored hashes fail closed without exceptions or upgrade flags',()=>{
  const salt='0'.repeat(32),hash='a'.repeat(128),validShape=`$scrypt$v=1$N=16384,r=8,p=5$${salt}$${hash}`;
  const invalid:any[]=[undefined,null,{},42,'','broken',':',salt+':',salt+':'+hash.slice(1),salt+':'+hash+':extra',salt+':'+hash+'\n',
    validShape+'\n',validShape+'$extra',validShape.replace('v=1','v=2'),validShape.replace('p=5','p=1'),validShape.replace('N=16384','N=2147483648'),
    validShape.replace('r=8','r=1'),validShape.replace(salt,salt+'0'),validShape.replace(hash,'z'.repeat(128)),validShape.replace('N=16384','N=016384'),'x'.repeat(100000)];
  for(const stored of invalid){assert.equal(passwordOK('password',stored),false);assert.equal(passwordNeedsUpgrade(stored),false);}
  assert.equal(passwordOK(null as any,validShape),false);assert.equal(passwordOK({} as any,validShape),false);
});
