module.exports = async function respond(res, work, status = 200) {
    try { return res.status(status).json({ success: true, data: await work() }); }
    catch (error) {
        let code = error.status || 500;
        let message = error.message;
        if (error.code === 'ER_DUP_ENTRY') { code = 409; message = 'O e-mail já está cadastrado.'; }
        if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
            code = 503; message = 'O serviço precisa de uma atualização do banco de dados.';
        } else if (code >= 500) { console.error('Falha na API:', error.code || error.message); message = 'Não foi possível concluir a operação. Tente novamente mais tarde.'; }
        return res.status(code).json({ success: false, error: message });
    }
};
