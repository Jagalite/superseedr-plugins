import React, { useState } from 'react';

interface AddTorrentModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiUrl?: string;
}

export const AddTorrentModal: React.FC<AddTorrentModalProps> = ({ isOpen, onClose, apiUrl }) => {
    const [activeTab, setActiveTab] = useState<'file' | 'magnet' | 'url'>('file');
    const [file, setFile] = useState<File | null>(null);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const baseUrl = apiUrl || import.meta.env.VITE_API_URL?.replace('/api/stats', '') || 'http://localhost:8080';

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        try {
            let response;
            if (activeTab === 'file') {
                if (!file) {
                    throw new Error('Please select a file');
                }
                const formData = new FormData();
                formData.append('file', file);
                
                response = await fetch(`${baseUrl}/api/upload`, {
                    method: 'POST',
                    body: formData,
                });
            } else {
                if (!content) {
                    throw new Error('Please enter content');
                }
                response = await fetch(`${baseUrl}/api/upload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: activeTab,
                        content: content,
                    }),
                });
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setMessage({ type: 'success', text: data.message || 'Success!' });
            
            // Clear inputs on success
            setFile(null);
            setContent('');
            
            // Close after a brief delay
            setTimeout(() => {
                onClose();
                setMessage(null);
            }, 1500);

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">Add Torrent</h3>
                    <button 
                        onClick={onClose}
                        className="text-text-muted hover:text-text-primary transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    <button
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'file' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-muted hover:text-text-primary'}`}
                        onClick={() => { setActiveTab('file'); setMessage(null); }}
                    >
                        File
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'magnet' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-muted hover:text-text-primary'}`}
                        onClick={() => { setActiveTab('magnet'); setMessage(null); }}
                    >
                        Magnet
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'url' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-muted hover:text-text-primary'}`}
                        onClick={() => { setActiveTab('url'); setMessage(null); }}
                    >
                        URL
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    {activeTab === 'file' ? (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-text-secondary">Torrent File</label>
                            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent-primary transition-colors cursor-pointer relative">
                                <input 
                                    type="file" 
                                    accept=".torrent"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {file ? (
                                    <div className="text-accent-primary font-medium truncate px-4">
                                        {file.name}
                                    </div>
                                ) : (
                                    <div className="text-text-muted">
                                        <p className="text-sm">Click or drag .torrent file here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-text-secondary">
                                {activeTab === 'magnet' ? 'Magnet Link' : 'Torrent URL'}
                            </label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={activeTab === 'magnet' ? 'magnet:?xt=urn:btih:...' : 'https://example.com/file.torrent'}
                                className="w-full bg-bg-secondary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:border-accent-primary h-32 resize-none"
                            />
                        </div>
                    )}

                    {/* Status Message */}
                    {message && (
                        <div className={`mt-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-4 py-2 text-sm font-bold text-white bg-accent-primary rounded-lg shadow-lg shadow-accent-primary/20 hover:bg-accent-secondary transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSubmitting ? 'Processing...' : 'Add Torrent'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
