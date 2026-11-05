const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

// The API runs against a dedicated database, dropped at the end of the tests
const TEST_DB = 'blog_test';
const PORT = 5098;
const API = `http://localhost:${PORT}/api`;
const SERVER_DIR = path.join(__dirname, '..');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let server;
let admin;
let db;
let author;
let other;
let articleId;
const uploadedFiles = [];

const startServer = () => new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['server.js'], {
        cwd: SERVER_DIR,
        env: { ...process.env, PORT, DB_NAME: TEST_DB },
    });
    const timeout = setTimeout(() => reject(new Error('Server did not start, is MySQL running?')), 30000);
    server.stdout.on('data', (data) => {
        if (data.toString().includes('initialized successfully')) {
            clearTimeout(timeout);
            resolve();
        }
    });
});

const request = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API}${url}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
};

const createUser = async (username) => {
    const credentials = { email: `${username}@test.local`, password: 'password123' };
    await request('POST', '/auth/register', { body: { ...credentials, username } });
    const { data } = await request('POST', '/auth/login', { body: credentials });
    return { token: data.token, id: data.user.id, username };
};

const createArticle = async (user, title = 'Article de test') => {
    const { data } = await request('POST', '/articles', {
        token: user.token,
        body: { title, content: 'Contenu de test' },
    });
    return data.id;
};

const createComment = async (user = author, content = 'Un commentaire', article = articleId) => {
    const { data } = await request('POST', `/articles/${article}/comments`, {
        token: user.token,
        body: { content },
    });
    return data;
};

const countComments = async (column, value) => {
    const [rows] = await db.query(`SELECT COUNT(*) AS total FROM comments WHERE ${column} = ?`, [value]);
    return rows[0].total;
};

before(async () => {
    admin = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });
    await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await startServer();

    db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: TEST_DB,
    });
    author = await createUser('author');
    other = await createUser('other');
    articleId = await createArticle(author);
});

after(async () => {
    server?.kill();
    uploadedFiles.forEach((file) => fs.rmSync(path.join(SERVER_DIR, file), { force: true }));
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await admin?.end();
});

// Authentication
test('A01 - publier sans token renvoie 403', async () => {
    const { status } = await request('POST', `/articles/${articleId}/comments`, { body: { content: 'x' } });
    assert.equal(status, 403);
});

test('A02 - publier avec un token invalide renvoie 401', async () => {
    const { status } = await request('POST', `/articles/${articleId}/comments`, { token: 'invalide', body: { content: 'x' } });
    assert.equal(status, 401);
});

test('A03 - modifier sans token renvoie 403', async () => {
    const comment = await createComment();
    const { status } = await request('PUT', `/comments/${comment.id}`, { body: { content: 'x' } });
    assert.equal(status, 403);
});

test('A04 - supprimer sans token renvoie 403', async () => {
    const comment = await createComment();
    const { status } = await request('DELETE', `/comments/${comment.id}`);
    assert.equal(status, 403);
});

// Validation
test('V01 - publier sans corps renvoie 400', async () => {
    const { status } = await request('POST', `/articles/${articleId}/comments`, { token: author.token });
    assert.equal(status, 400);
});

test('V02 - publier un contenu vide ou fait d\'espaces renvoie 400', async () => {
    for (const content of ['', '     ']) {
        const { status } = await request('POST', `/articles/${articleId}/comments`, { token: author.token, body: { content } });
        assert.equal(status, 400);
    }
});

test('V03 - publier 2001 caractères renvoie 400', async () => {
    const { status } = await request('POST', `/articles/${articleId}/comments`, { token: author.token, body: { content: 'a'.repeat(2001) } });
    assert.equal(status, 400);
});

test('V04 - publier exactement 2000 caractères renvoie 201', async () => {
    const { status } = await request('POST', `/articles/${articleId}/comments`, { token: author.token, body: { content: 'a'.repeat(2000) } });
    assert.equal(status, 201);
});

test('V05 - publier un contenu qui n\'est pas du texte renvoie 400', async () => {
    for (const content of [{ a: 1 }, ['a'], 42, null]) {
        const { status } = await request('POST', `/articles/${articleId}/comments`, { token: author.token, body: { content } });
        assert.equal(status, 400);
    }
});

test('V06 - commenter un article inexistant renvoie 404', async () => {
    const { status } = await request('POST', '/articles/99999999/comments', { token: author.token, body: { content: 'x' } });
    assert.equal(status, 404);
});

test('V07 - modifier ou supprimer un commentaire inexistant renvoie 404', async () => {
    const updated = await request('PUT', '/comments/99999999', { token: author.token, body: { content: 'x' } });
    const deleted = await request('DELETE', '/comments/99999999', { token: author.token });
    assert.equal(updated.status, 404);
    assert.equal(deleted.status, 404);
});

test('V08 - modifier avec un contenu vide renvoie 400', async () => {
    const comment = await createComment();
    const { status } = await request('PUT', `/comments/${comment.id}`, { token: author.token, body: { content: '   ' } });
    assert.equal(status, 400);
});

// Reading
test('L01 - la liste est publique, chronologique et contient l\'auteur', async () => {
    const article = await createArticle(author);
    const first = await createComment(author, 'Premier', article);
    const second = await createComment(other, 'Second', article);

    const { status, data } = await request('GET', `/articles/${article}/comments`);

    assert.equal(status, 200);
    assert.deepEqual(data.map((comment) => comment.id), [first.id, second.id]);
    assert.deepEqual(data.map((comment) => comment.username), ['author', 'other']);
});

// Permissions
test('D01 - l\'auteur vient du token et non du corps de la requête', async () => {
    const { status, data } = await request('POST', `/articles/${articleId}/comments`, {
        token: author.token,
        body: { content: 'Usurpation', user_id: other.id },
    });
    assert.equal(status, 201);
    assert.equal(data.user_id, author.id);
});

test('D02 - un autre utilisateur ne peut pas modifier le commentaire', async () => {
    const comment = await createComment(author, 'Original');
    const { status } = await request('PUT', `/comments/${comment.id}`, { token: other.token, body: { content: 'Pirate' } });

    const [rows] = await db.query('SELECT content FROM comments WHERE id = ?', [comment.id]);
    assert.equal(status, 403);
    assert.equal(rows[0].content, 'Original');
});

test('D03 - un autre utilisateur ne peut pas supprimer le commentaire', async () => {
    const comment = await createComment();
    const { status } = await request('DELETE', `/comments/${comment.id}`, { token: other.token });

    assert.equal(status, 403);
    assert.equal(await countComments('id', comment.id), 1);
});

test('D04 - l\'auteur peut modifier son commentaire', async () => {
    const comment = await createComment();
    const { status } = await request('PUT', `/comments/${comment.id}`, { token: author.token, body: { content: 'Modifié' } });

    const [rows] = await db.query('SELECT content FROM comments WHERE id = ?', [comment.id]);
    assert.equal(status, 200);
    assert.equal(rows[0].content, 'Modifié');
});

test('D05 - l\'auteur peut supprimer son commentaire', async () => {
    const comment = await createComment();
    const { status } = await request('DELETE', `/comments/${comment.id}`, { token: author.token });

    assert.equal(status, 200);
    assert.equal(await countComments('id', comment.id), 0);
});

// SQL injection
test('S01 - une injection SQL dans un commentaire reste du texte', async () => {
    const content = '\'); DROP TABLE comments;--';
    const comment = await createComment(author, content);

    assert.equal(comment.content, content);
    assert.equal(await countComments('id', comment.id), 1);
});

test('S02 - une injection SQL dans l\'identifiant ne renvoie aucun commentaire', async () => {
    await createComment();
    const { status, data } = await request('GET', `/articles/${encodeURIComponent('0 OR 1=1')}/comments`);

    assert.equal(status, 200);
    assert.deepEqual(data, []);
});

test('S03 - une injection SQL dans un article reste du texte', async () => {
    const title = 'x\'); DROP TABLE articles;--';
    const id = await createArticle(author, title);
    const { data } = await request('GET', `/articles/${id}`);

    assert.equal(data.title, title);
});

test('S04 - l\'image d\'un article modifié a un chemin valide et reste accessible', async () => {
    const id = await createArticle(author);
    const form = new FormData();
    form.append('title', 'Avec image');
    form.append('content', 'Contenu');
    form.append('image', new Blob([PNG], { type: 'image/png' }), 'image.png');

    await fetch(`${API}/articles/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${author.token}` },
        body: form,
    });

    const { data } = await request('GET', `/articles/${id}`);
    if (data.image) uploadedFiles.push(data.image);
    const image = await fetch(`http://localhost:${PORT}${data.image}`);

    assert.match(data.image, /^\/uploads\/\d+\.png$/);
    assert.equal(image.status, 200);
});

// Cascade
test('C01 - supprimer un article supprime ses commentaires', async () => {
    const article = await createArticle(author);
    await createComment(other, 'À supprimer', article);
    assert.equal(await countComments('article_id', article), 1);

    await request('DELETE', `/articles/${article}`, { token: author.token });

    assert.equal(await countComments('article_id', article), 0);
});

test('C02 - supprimer un utilisateur supprime ses commentaires', async () => {
    const user = await createUser('temporary');
    await createComment(user);
    assert.equal(await countComments('user_id', user.id), 1);

    await db.query('DELETE FROM users WHERE id = ?', [user.id]);

    assert.equal(await countComments('user_id', user.id), 0);
});
