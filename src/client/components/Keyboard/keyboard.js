import { Col, InputNumber, List, notification, Row, Switch } from 'antd';
import 'antd/dist/antd.css';
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import io from 'socket.io-client';
import './keyboard.css';
import Layout from './layout';

const START = 1;
const MOVE = 2;
const END = 3;
const EXPLORE = 4;
const Keyboard = ({ cRef }) => {
    const canvasRef = useRef(null);
    const layout = useRef(null);

    const sampleSize = 50;
    const [candidates, setCandidates] = useState([]);
    const [isStart, setIsStart] = useState(false);
    const [userPath, setUserPath] = useState([]);
    const [cursorPos, setCursorPos] = useState(null);
    const [wordDict, setWordDict] = useState([]);
    const [useMouse, setUseMouse] = useState(false);
    const [corpusSize, setCorpusSize] = useState(1000);

    useImperativeHandle(cRef, () => ({
        onEvent: (type, pos, normalized) => {
            onEvent(type, pos, normalized);
        }
    }));

    useEffect(() => {
        updateCanvas();
    }, [userPath]);
    
    useEffect(() => {
        init();
    }, [canvasRef]);

    useEffect(() => {
        loadCorpus();
        const socket = io(document.domain + ':8081');
        socket.on('connect', () => {
            console.log('connected!!');
        });
        socket.on('data', data => {
            const lines = data.split('\n');
            lines.forEach(element => {
                const [t, x, y] = element.split(' ');
                onEvent(
                    parseInt(t),
                    { x: parseFloat(x), y: parseFloat(y) },
                    true
                );
            });
        });
    }, []);

    const init = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const keyboardHeight = 450 / 2;
        const keyboardParameter = {
            width: canvas.width,
            height: keyboardHeight,
            posx: 0, // position of keyboard in canvas
            posy: canvas.height - keyboardHeight,
        };
        layout.current = new Layout(keyboardParameter);
        layout.current.render(context);
    }

    const windowToCanvas = (c, x, y) => {
        const rect = c.getBoundingClientRect();
        const xpos = x - rect.left * (c.width / rect.width);
        const ypos = y - rect.top * (c.height / rect.height);
        return { x: xpos, y: ypos };
    }

    const mouseControl = (type, e) => {
        if (useMouse) {
            const pos = windowToCanvas(canvasRef.current, e.clientX, e.clientY);
            onEvent(type, pos);
        }
    }

    const openNotification = (type, content) => {
        notification[type]({
            message: content
        });
    };

    const loadCorpus = () => {
        fetch('/corpus.txt')
            .then(res => res.text())
            .then(data => {
                const lineData = data.split('\n');
                const tempDict = [];
                for (const item of lineData) {
                    let [word, freq] = item.split(' ');
                    word = word.trim();
                    freq = parseInt(freq);
                    tempDict.push([word, freq, getPath(word)]);
                }
                setWordDict(tempDict);
                // console.log(wordDict);
                openNotification('success', '词库加载成功');
            })
            .catch(err => {
                openNotification('error', '词库加载失败' + err);
            });
    }

    const getPath = word => {
        const ret = [];
        for (const i of word) {
            ret.push(layout.current.getCenter(i));
        }
        return resamplePath(ret);
    }

     const resamplePath = path => {
        const n = path.length;
        const ret = [];
        if (n === 1) {
            for (let i = 0; i < sampleSize; i ++) {
                ret.push(path[0]);
            }
            return ret;
        }
        let length = 0;
        for (let i = 0; i < n - 1; i ++) {
            length += distance(path[i], path[i + 1]);
        }
        const interval = length / (sampleSize - 1);
        let lastPos = path[0];
        let currLen = 0;
        let no = 1;
        ret.push(path[0]);
        while (no < n) {
            const dist = distance(lastPos, path[no]);
            if (currLen + dist >= interval && dist > 0) {
                const ratio = (interval - currLen) / dist;
                const { x, y } = lastPos;
                lastPos = {
                    x: x + ratio * (path[no].x - x),
                    y: y + ratio * (path[no].y - y),
                }
                ret.push(lastPos);
                currLen = 0;
            } else {
                currLen += dist;
                lastPos = path[no];
                no ++;
            }
        }
        for (let i = ret.length; i < sampleSize; i ++) {
            ret.push(path[n - 1]);
        }
        return ret;
    }

    const distance = (t1, t2) => {
        const dx = t1.x - t2.x;
        const dy = t1.y - t2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    const updateCanvas = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (context === null) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.beginPath();
        if (layout.current !== null) {
            layout.current.render(context);
        }
        const uPath = userPath;
        if (uPath.length > 0) {
            context.moveTo(uPath[0].x, uPath[0].y);
            for (let i = 1; i < uPath.length; i ++) {
                context.lineTo(uPath[i].x, uPath[i].y);
            }
            context.stroke();
        }
        if (cursorPos !== null) {
            context.beginPath();
            context.arc(cursorPos.x, cursorPos.y, 5, 0, 2 * Math.PI);
            context.fill();
        }
    }

    const onEvent = (type, pos, normalized=false) => {
        if (type !== START && type !== MOVE && type !== EXPLORE && type !== END)
            return;
        if (normalized) {
            pos.x = pos.x * canvasRef.current.width;
            pos.y = pos.y * canvasRef.current.height;
        }
        setCursorPos(pos);
        switch (type) {
            case START:
                setUserPath([pos]);
                setIsStart(true);
                break;
            case MOVE:
            case EXPLORE:
                if (isStart) {
                    setUserPath(userPath.concat([pos]));
                }                
                break;
            case END:
                if (isStart) {
                    setUserPath(userPath.concat([pos]));
                    calculateCandidate();
                }
                setIsStart(false);
                break;
            default:
                break;
        }
    }

    const similarity = (p1, p2) => {
        if (p1.length !== sampleSize || p2.length !== sampleSize) {
            throw new Error(`Path length invalid! ${p1.length}, ${p2.length}`);
        }
        let ret = 0;
        for (let i = 0; i < sampleSize; i ++) {
            ret += distance(p1[i], p2[i]);
        }
        return ret / sampleSize;
    }
    
    const calculateCandidate = () => {
        // console.log('in calculate candidate');
        const userP = resamplePath(userPath);
        const ans = [];
        let totDis = 0;
        let totFreq = 0;
        for (let i = 0; i < corpusSize; i ++) {
            const [word, freq, path] = wordDict[i];
            const dis = similarity(userP, path);
            ans.push([word, -Math.log(dis)]); // - 15 * Math.log(dis)]);
            totDis += 1 / dis;
            totFreq += freq;
        }
        // for (let i = 0; i < ans.length; i ++) {
        //     ans[i][1] += Math.log(wordDict[i][1]);Math.log(ans[i][1]) + Math.log(wordDict[i][1] / totFreq);
        // }
        ans.sort((a, b) => b[1] - a[1]);
        setCandidates(ans.slice(0, 5));
    };

    return (
        <Row style={{ textAlign: 'center' }}>
            <Col span={12}>
                <canvas
                    ref={canvasRef} width="450" height="450"  
                    onMouseDown={e => mouseControl(START, e)}
                    onMouseMove={e => mouseControl(MOVE, e)}
                    onMouseUp={e => mouseControl(END, e)}
                />
            </Col>
            <Col span={6}>
                <List
                    header={<div>候选词列表</div>}
                    bordered
                    dataSource={candidates}
                    renderItem={item => (
                        <List.Item>
                            <div>{ item[0] }</div>
                        </List.Item>
                    )}
                />
            </Col>
            <Col span={6}>
                配置 { corpusSize }
                <InputNumber onChange={v => setCorpusSize(v)} value={corpusSize} />
                绑定鼠标: <Switch size="small" checked={useMouse} onChange={v => setUseMouse(v)} />
            </Col>
        </Row>
    );
}

export default Keyboard;