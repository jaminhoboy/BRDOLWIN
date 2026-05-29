// js/engines/probability.js
window.BRDOLWINProbability = {
    calculateProbabilities(consensusScore) {
        // Base probability calculation from consensus score (0-100)
        // Score > 50 tends to Alta, < 50 tends to Baixa, ~50 is Lateral
        
        let alta = 0, baixa = 0, lateral = 0;
        
        if (consensusScore >= 60) {
            alta = 45 + (consensusScore - 60);
            lateral = 30 - ((consensusScore - 60) / 2);
            baixa = 100 - alta - lateral;
        } else if (consensusScore <= 40) {
            baixa = 45 + (40 - consensusScore);
            lateral = 30 - ((40 - consensusScore) / 2);
            alta = 100 - baixa - lateral;
        } else {
            lateral = 40 + (10 - Math.abs(50 - consensusScore));
            alta = 30 + ((consensusScore - 50) / 2);
            baixa = 100 - lateral - alta;
        }

        // Anti-certeza absoluta cap (nunca passa de 85% nem cai abaixo de 5%)
        alta = Math.min(85, Math.max(5, Math.round(alta)));
        baixa = Math.min(85, Math.max(5, Math.round(baixa)));
        lateral = 100 - alta - baixa;

        return {
            alta: alta,
            baixa: baixa,
            lateral: lateral
        };
    }
};

// js/engines/confidence.js
window.BRDOLWINConfidence = {
    calculateConfidence(consensusData) {
        // Mocked logic for UI
        const confidenceScore = consensusData.forcaConsenso || 60;
        let classification = 'Moderada';
        
        if (confidenceScore >= 80) classification = 'Muito Alta';
        else if (confidenceScore >= 65) classification = 'Alta';
        else if (confidenceScore >= 45) classification = 'Moderada';
        else if (confidenceScore >= 30) classification = 'Baixa';
        else classification = 'Evitar Operação';

        return {
            geral: confidenceScore,
            classificacao: classification
        };
    }
};

// js/engines/windows.js
window.BRDOLWINWindows = {
    getOperationalWindow() {
        const now = new Date();
        const hour = now.getHours();
        const min = now.getMinutes();
        const time = hour + (min / 60);

        let status = 'neutra';
        let desc = 'Horário regular';

        if (time >= 9.25 && time <= 10.5) {
            status = 'premium'; desc = 'Abertura BR (Alta Liquidez)';
        } else if (time >= 14.75 && time <= 15.75) {
            status = 'premium'; desc = 'Abertura US (Alta Liquidez)';
        } else if (time >= 11.5 && time <= 13.5) {
            status = 'evitar'; desc = 'Almoço (Iliquidez/Armadilhas)';
        }

        return {
            janelaAtual: status,
            descricao: desc
        };
    }
};
