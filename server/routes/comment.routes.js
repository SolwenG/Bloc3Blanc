const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const verifyToken = require('../middleware/auth');

router.get('/articles/:articleId/comments', commentController.getCommentsByArticle);
router.post('/articles/:articleId/comments', verifyToken, commentController.createComment);
router.put('/comments/:id', verifyToken, commentController.updateComment);
router.delete('/comments/:id', verifyToken, commentController.deleteComment);

module.exports = router;
