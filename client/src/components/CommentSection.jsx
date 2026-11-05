import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API, { API_URL } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { renderComment } from '../utils/renderComment';
import { Edit, Trash2, Calendar, User, Send, Save, X } from 'lucide-react';

const MAX_CONTENT_LENGTH = 2000;

const getErrorMessage = (err) => {
    const status = err.response?.status;
    if (status === 401 || status === 403) return 'Action non autorisée. Reconnectez-vous si votre session a expiré.';
    if (status === 400) return 'Le commentaire doit contenir entre 1 et 2000 caractères.';
    if (status === 404) return 'Ce contenu n\'existe plus.';
    return 'Une erreur est survenue, veuillez réessayer.';
};

const CommentSection = ({ articleId }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchComments = async () => {
            try {
                const { data } = await API.get(`/articles/${articleId}/comments`);
                setComments(data);
            } catch (err) {
                console.error(err);
                setError('Impossible de charger les commentaires.');
            } finally {
                setLoading(false);
            }
        };
        fetchComments();
    }, [articleId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const { data } = await API.post(`/articles/${articleId}/comments`, { content });
            setComments([...comments, data]);
            setContent('');
        } catch (err) {
            console.error(err);
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const startEditing = (comment) => {
        setEditingId(comment.id);
        setEditContent(comment.content);
        setError('');
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            await API.put(`/comments/${editingId}`, { content: editContent });
            setComments(comments.map((comment) => (
                comment.id === editingId ? { ...comment, content: editContent.trim() } : comment
            )));
            setEditingId(null);
        } catch (err) {
            console.error(err);
            setError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (commentId) => {
        if (window.confirm('Voulez-vous vraiment supprimer ce commentaire ?')) {
            setError('');
            try {
                await API.delete(`/comments/${commentId}`);
                setComments(comments.filter((comment) => comment.id !== commentId));
            } catch (err) {
                console.error(err);
                setError(getErrorMessage(err));
            }
        }
    };

    return (
        <section style={{ marginTop: '50px', paddingTop: '30px', borderTop: '1px solid var(--border)' }}>
            <h2 style={{ marginBottom: '20px' }}>Commentaires ({comments.length})</h2>

            {error && <p role="alert" style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</p>}

            {user ? (
                <form onSubmit={handleSubmit} className="glass" style={{ padding: '20px', marginBottom: '30px' }}>
                    <label htmlFor="comment-content" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                        Votre commentaire (texte, Markdown ou HTML)
                    </label>
                    <textarea
                        id="comment-content"
                        placeholder="Écrivez votre commentaire ici..."
                        rows="4"
                        maxLength={MAX_CONTENT_LENGTH}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                        style={{ fontFamily: 'inherit' }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={submitting || !content.trim()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Send size={18} /> {submitting ? 'Publication...' : 'Publier'}
                    </button>
                </form>
            ) : (
                <p className="glass" style={{ padding: '20px', marginBottom: '30px', color: 'var(--text-muted)' }}>
                    <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Connectez-vous</Link> pour laisser un commentaire.
                </p>
            )}

            {loading && <div>Chargement...</div>}
            {!loading && comments.length === 0 && (
                <p style={{ color: 'var(--text-muted)' }}>Aucun commentaire pour le moment.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {comments.map((comment) => (
                    <article key={comment.id} className="glass" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {comment.avatar ? (
                                    <img src={`${API_URL}${comment.avatar}`} alt={comment.username} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                ) : <User size={24} />}
                                <div>
                                    <Link to={`/profile/${comment.user_id}`} style={{ fontWeight: 'bold' }}>{comment.username}</Link>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Calendar size={12} /> {new Date(comment.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            {user && user.id === comment.user_id && editingId !== comment.id && (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => startEditing(comment)} className="btn glass" style={{ padding: '6px 10px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                                        <Edit size={14} /> Modifier
                                    </button>
                                    <button onClick={() => handleDelete(comment.id)} className="btn" style={{ padding: '6px 10px', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                                        <Trash2 size={14} /> Supprimer
                                    </button>
                                </div>
                            )}
                        </div>

                        {editingId === comment.id ? (
                            <form onSubmit={handleUpdate}>
                                <textarea
                                    aria-label="Modifier le commentaire"
                                    rows="4"
                                    maxLength={MAX_CONTENT_LENGTH}
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    required
                                    style={{ fontFamily: 'inherit' }}
                                />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="submit" className="btn btn-primary" disabled={submitting || !editContent.trim()} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Save size={16} /> Enregistrer
                                    </button>
                                    <button type="button" onClick={() => setEditingId(null)} className="btn glass" style={{ padding: '8px 12px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <X size={16} /> Annuler
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="comment-content" dangerouslySetInnerHTML={{ __html: renderComment(comment.content) }} />
                        )}
                    </article>
                ))}
            </div>
        </section>
    );
};

export default CommentSection;
