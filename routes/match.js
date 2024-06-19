// routes/match.js

const express = require('express');
const router = express.Router();
const Match = require('../models/Matchmodel');
const User = require('../models/Usermodel');
const { auth } = require('../middleware/auth');

// 매칭 요청 생성
router.post('/request', auth, async (req, res) => {
    try {
        const { userId } = req.body;
        const existingMatch = await Match.findOne({ user1: req.user._id, user2: userId, status: 'pending' });

        if (existingMatch) {
            return res.status(400).json({ message: '매칭 요청이 이미 존재합니다.' });
        }

        const match = new Match({ user1: req.user._id, user2: userId });
        await match.save();
        res.status(200).json({ message: '매칭 요청이 성공적으로 생성되었습니다.', match });
    } catch (error) {
        res.status(500).json({ message: '매칭 요청 생성 중 오류가 발생했습니다.', error });
    }
});

// 매칭 요청 수락
router.post('/accept', auth, async (req, res) => {
    try {
        const { matchId } = req.body;
        const match = await Match.findById(matchId);

        if (!match) {
            return res.status(404).json({ message: '매칭 요청을 찾을 수 없습니다.' });
        }

        if (match.user2.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: '매칭 요청을 수락할 권한이 없습니다.' });
        }

        match.status = 'matched';
        await match.save();
        res.status(200).json({ message: '매칭 요청이 성공적으로 수락되었습니다.', match });
    } catch (error) {
        res.status(500).json({ message: '매칭 요청 수락 중 오류가 발생했습니다.', error });
    }
});

module.exports = router;
