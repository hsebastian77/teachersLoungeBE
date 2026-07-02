import app from './app.js';

const PORT = process.env.PORT || 4001;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`server running on 0.0.0.0:${PORT}`);
});
