const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function getEnv() {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split(/\r?\n/).forEach(line => {
        const firstEq = line.indexOf('=');
        if (firstEq !== -1) {
            const key = line.substring(0, firstEq).trim();
            let value = line.substring(firstEq + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            env[key] = value;
        }
    });
    return env;
}

const env = getEnv();
let privateKey = env.GOOGLE_PRIVATE_KEY;

if (!privateKey) {
    console.error('❌ GOOGLE_PRIVATE_KEY not found');
    process.exit(1);
}

// Clean key
privateKey = privateKey.replace(/\\n/g, '\n');

console.log('--- KEY DEBUG ---');
console.log('Total length:', privateKey.length);
console.log('Starts with:', privateKey.substring(0, 30));
console.log('Ends with:', privateKey.substring(privateKey.length - 30));

try {
    const sign = crypto.createSign('SHA256');
    sign.update('message');
    const signature = sign.sign(privateKey);
    console.log('✅ SHA256 서명 성공! 키가 유효합니다.');
} catch (e) {
    console.error('❌ 서명 실패 (OpenSSL 오류):', e.message);

    console.log('\n--- 제안: 키 자동 복구 시도 ---');
    // 복구 시도: 헤더와 푸터를 제외한 내부 문자열을 64자씩 끊어서 다시 포맷팅
    const body = privateKey
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '');

    const formattedKey = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;

    try {
        const sign2 = crypto.createSign('SHA256');
        sign2.update('message');
        sign2.sign(formattedKey);
        console.log('✅ 복구된 키로 서명 성공! 이 형식을 사용해야 합니다.');
        console.log('\n[복구된 키 (복사해서 .env.local에 넣으세요)]');
        console.log(formattedKey.replace(/\n/g, '\\n'));
    } catch (e2) {
        console.error('❌ 복구된 키도 실패:', e2.message);
    }
}
