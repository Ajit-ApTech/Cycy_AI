import React, { useEffect } from 'react';
import { useAgentStore, PendingCommand } from '../store/agentStore';

const ApprovalGate: React.FC = () => {
    const { pendingCommands, addPendingCommand, updateCommandStatus } = useAgentStore();

    useEffect(() => {
        // Listen for agent command requests from CommandGate
        window.devmindAPI.agent.onCommandRequest((data: { id: string, command: string, timestamp: number }) => {
            addPendingCommand({
                ...data,
                status: 'pending'
            });
        });
    }, [addPendingCommand]);

    const handleApprove = async (id: string) => {
        try {
            await window.devmindAPI.agent.approveCommand(id);
            updateCommandStatus(id, 'approved');
            // Later this gets updated to 'executed'
        } catch (err) {
            console.error('Approval failed', err);
        }
    };

    const handleReject = async (id: string) => {
        try {
            await window.devmindAPI.agent.cancelCommand(id);
            updateCommandStatus(id, 'rejected');
        } catch (err) {
            console.error('Rejection failed', err);
        }
    };

    const pendingList = pendingCommands.filter(c => c.status === 'pending');

    if (pendingList.length === 0) return null;

    return (
        <div style={{ position: 'fixed', bottom: '20px', right: '320px', background: '#252526', border: '1px solid #007acc', padding: '15px', borderRadius: '8px', zIndex: 1000, color: 'white' }}>
            <h3 style={{ marginTop: 0, color: '#007acc' }}>Agent requires approval</h3>
            {pendingList.map(cmd => (
                <div key={cmd.id} style={{ marginBottom: '10px' }}>
                    <div style={{ background: '#1e1e1e', padding: '10px', borderRadius: '4px', fontFamily: 'monospace', marginBottom: '10px' }}>
                        {cmd.command}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleApprove(cmd.id)} style={{ background: '#4CAF50', color: 'white', padding: '5px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Approve</button>
                        <button onClick={() => handleReject(cmd.id)} style={{ background: '#f44336', color: 'white', padding: '5px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ApprovalGate;
