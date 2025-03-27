import { Server } from 'socket.io';

export default function initWS(server) {
    const io = new Server(server);

    io.on('connection', (socket) => {
        console.log('New client connected');

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });

    return io;
}