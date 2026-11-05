const { pool } = require('../config/db');

const MAX_CONTENT_LENGTH = 2000;

const validateContent = (content) => {
    if (typeof content !== 'string' || content.trim().length === 0) {
        return 'Comment content is required';
    }
    if (content.length > MAX_CONTENT_LENGTH) {
        return `Comment must not exceed ${MAX_CONTENT_LENGTH} characters`;
    }
    return null;
};

exports.getCommentsByArticle = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT comments.*, users.username, users.avatar
            FROM comments
            JOIN users ON comments.user_id = users.id
            WHERE comments.article_id = ?
            ORDER BY comments.created_at ASC, comments.id ASC
        `, [req.params.articleId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createComment = async (req, res) => {
    try {
        const content = req.body?.content;
        const error = validateContent(content);
        if (error) return res.status(400).json({ message: error });

        const [articles] = await pool.query('SELECT id FROM articles WHERE id = ?', [req.params.articleId]);
        if (articles.length === 0) return res.status(404).json({ message: 'Article not found' });

        const [result] = await pool.query(
            'INSERT INTO comments (content, article_id, user_id) VALUES (?, ?, ?)',
            [content.trim(), articles[0].id, req.userId]
        );

        const [rows] = await pool.query(`
            SELECT comments.*, users.username, users.avatar
            FROM comments
            JOIN users ON comments.user_id = users.id
            WHERE comments.id = ?
        `, [result.insertId]);

        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateComment = async (req, res) => {
    try {
        const content = req.body?.content;
        const error = validateContent(content);
        if (error) return res.status(400).json({ message: error });

        const [comments] = await pool.query('SELECT * FROM comments WHERE id = ?', [req.params.id]);

        if (comments.length === 0) return res.status(404).json({ message: 'Comment not found' });
        if (comments[0].user_id !== req.userId) return res.status(403).json({ message: 'Not authorized' });

        await pool.query('UPDATE comments SET content = ? WHERE id = ?', [content.trim(), req.params.id]);

        res.json({ message: 'Comment updated successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const [comments] = await pool.query('SELECT * FROM comments WHERE id = ?', [req.params.id]);

        if (comments.length === 0) return res.status(404).json({ message: 'Comment not found' });
        if (comments[0].user_id !== req.userId) return res.status(403).json({ message: 'Not authorized' });

        await pool.query('DELETE FROM comments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Comment deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
