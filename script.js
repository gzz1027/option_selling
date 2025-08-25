// 期权卖方EV计算器 JavaScript 代码

// 全局变量
let currentResults = {};
let importedOptions = []; // 存储导入的期权数据

// CSV导入和API获取相关函数
function setupCSVImport() {
    console.log('设置CSV导入和API功能...');
    
    const fileInput = document.getElementById('csv-file');
    const fileSelectBtn = document.getElementById('file-select-btn');
    const importBtn = document.getElementById('import-btn');
    const apiBtn = document.getElementById('api-btn');
    
    console.log('查找的元素:', {
        fileInput: !!fileInput,
        fileSelectBtn: !!fileSelectBtn,
        importBtn: !!importBtn,
        apiBtn: !!apiBtn
    });
    
    if (!fileInput || !fileSelectBtn || !importBtn || !apiBtn) {
        console.error('必要的元素未找到', {
            fileInput: !!fileInput,
            fileSelectBtn: !!fileSelectBtn,
            importBtn: !!importBtn,
            apiBtn: !!apiBtn
        });
        return;
    }
    
    // 为文件选择按钮添加点击事件
    fileSelectBtn.addEventListener('click', function() {
        console.log('文件选择按钮被点击');
        fileInput.click();
    });
    
    // 绑定文件选择事件
    fileInput.addEventListener('change', function(e) {
        console.log('文件选择事件触发');
        const file = e.target.files[0];
        if (file) {
            const fileNameElement = document.getElementById('file-name');
            if (fileNameElement) {
                fileNameElement.textContent = file.name;
            }
            
            importBtn.disabled = false;
            console.log('文件已选择:', file.name);
        } else {
            const fileNameElement = document.getElementById('file-name');
            if (fileNameElement) {
                fileNameElement.textContent = '未选择文件';
            }
            importBtn.disabled = true;
        }
    });
    
    // 绑定导入按钮事件
    importBtn.addEventListener('click', function() {
        console.log('导入按钮被点击');
        importCSV();
    });
    
    // 绑定API按钮事件
    apiBtn.addEventListener('click', function() {
        console.log('API按钮被点击');
        fetchDataFromAPI();
    });
    
    console.log('CSV导入和API功能设置完成');
}

// 导入CSV文件
function importCSV() {
    console.log('开始导入CSV...');
    
    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showError('请先选择CSV文件');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            console.log('CSV文件读取成功，长度:', csvText.length);
            
            // 保存原始CSV文本到全局变量，用于提取到期信息
            window.rawCSVText = csvText;
            
            const csvData = parseCSV(csvText);
            console.log('CSV解析完成，数据行数:', csvData.length);
            
            // 设置默认值（这些值会在processCSVData中被自动更新）
            let underlyingPrice = 340.00; // 默认值
            let daysToExpiry = 6; // 默认值
            
            const result = processCSVData(csvData, underlyingPrice, daysToExpiry);
            importedOptions = result;
            
            // 使用从CSV提取的更新值
            underlyingPrice = result.underlyingPrice || underlyingPrice;
            daysToExpiry = result.daysToExpiry || daysToExpiry;
            
            console.log('处理完成，有效期权数量:', importedOptions.length);
            console.log('更新后的标的价格:', underlyingPrice);
            console.log('更新后的到期天数:', daysToExpiry);
            
            if (importedOptions.length === 0) {
                showError('没有找到有效的期权数据，请检查CSV格式');
                return;
            }
            
            // 自动设置Delta范围默认值
            autoSetDeltaRange(importedOptions);
            
            // 显示导入成功信息
            alert(`CSV导入成功！\n共导入 ${importedOptions.length} 个期权\n已自动设置Delta范围！\n现在可以使用过滤系统了！`);
            
            // 直接计算期望价值(EV)，跳过数据预览
            console.log('开始计算期望价值...');
            const optionsWithEV = calculateAllOptionsEV(importedOptions, underlyingPrice, daysToExpiry);
            
            // 只有在有数据时才显示EV结果
            if (optionsWithEV && optionsWithEV.length > 0) {
                showEVResults(optionsWithEV);
                
                // 隐藏预览区域，显示结果区域
                const importPreview = document.getElementById('import-preview');
                if (importPreview) {
                    importPreview.style.display = 'none';
                }
                
                const resultsSection = document.getElementById('results-section');
                if (resultsSection) {
                    resultsSection.style.display = 'block';
                }
            } else {
                console.log('没有期权数据，不显示结果');
                // 确保结果区域隐藏
                const resultsSection = document.getElementById('results-section');
                if (resultsSection) {
                    resultsSection.style.display = 'none';
                }
            }
            
            // 存储带EV的期权数据
            window.optionsWithEV = optionsWithEV;
            
        } catch (error) {
            console.error('CSV处理错误:', error);
            showError('CSV解析失败: ' + error.message);
        }
    };
    
    reader.readAsText(file);
}

// 解析CSV数据
function parseCSV(csvText) {
    console.log('开始解析CSV...');
    console.log('CSV文本长度:', csvText.length);
    console.log('CSV前100个字符:', csvText.substring(0, 100));
    
    const lines = csvText.split('\n');
    console.log('CSV总行数:', lines.length);
    
    if (lines.length === 0) {
        console.error('CSV文件为空');
        return [];
    }
    
    // 检查第一行（列名行）
    const firstLine = lines[0];
    console.log('第一行长度:', firstLine.length);
    console.log('第一行内容:', firstLine);
    
    // 手动解析列名，处理引号和逗号
    const headers = parseCSVLine(firstLine);
    
    console.log('解析出的列名数量:', headers.length);
    console.log('所有列名:', headers);
    
    const data = [];
    
    // 从第3行开始解析数据（跳过标题行和元数据行）
    for (let i = 2; i < lines.length; i++) {
        if (lines[i].trim()) {
            console.log(`解析第${i}行: ${lines[i].substring(0, 100)}...`);
            
            const values = parseCSVLine(lines[i]);
            
            // 确保每行都有足够的列
            if (values.length >= headers.length) {
                const row = {};
                
                console.log(`第${i}行: values长度=${values.length}, headers长度=${headers.length}`);
                console.log(`前5个headers: ${headers.slice(0, 5)}`);
                console.log(`后5个headers: ${headers.slice(-5)}`);
                console.log(`前5个values: ${values.slice(0, 5)}`);
                console.log(`后5个values: ${values.slice(-5)}`);
                
                // 处理重复列名问题
                const usedHeaders = new Set();
                const uniqueHeaders = [];
                
                headers.forEach((header, index) => {
                    let uniqueHeader = header;
                    let counter = 1;
                    
                    // 如果列名已存在，添加索引后缀
                    while (usedHeaders.has(uniqueHeader)) {
                        uniqueHeader = `${header}_${counter}`;
                        counter++;
                    }
                    
                    usedHeaders.add(uniqueHeader);
                    uniqueHeaders.push(uniqueHeader);
                    
                    console.log(`设置键 ${index}: ${uniqueHeader} = ${values[index]}`);
                    row[uniqueHeader] = values[index] || '';
                });
                
                data.push(row);
                
                // 检查第一行数据是否完整
                if (i === 2) {
                    console.log('第一行数据对象:', row);
                    console.log('第一行数据键数量:', Object.keys(row).length);
                    console.log('第一行数据键:', Object.keys(row));
                }
            } else {
                console.warn(`第${i}行列数不足: 期望${headers.length}列，实际${values.length}列`);
                console.warn(`行内容: ${lines[i]}`);
            }
        }
    }
    
    console.log('解析完成，数据行数:', data.length);
    return data;
}

// 解析CSV行数据
function parseCSVLine(line) {
    console.log('解析行:', line);
    console.log('行长度:', line.length);
    
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    
    // 添加最后一个值
    values.push(currentValue.trim());
    
    console.log('解析出的值数量:', values.length);
    console.log('前5个值:', values.slice(0, 5));
    console.log('后5个值:', values.slice(-5));
    
    return values;
}

// 处理CSV数据
function processCSVData(csvData, underlyingPrice, daysToExpiry) {
    const options = [];
    const callOptions = [];
    const putOptions = [];
    
    console.log('开始处理CSV数据...');
    console.log('标的价格:', underlyingPrice, '到期天数:', daysToExpiry);
    console.log('CSV数据行数:', csvData.length);
    
    // 尝试从CSV数据中提取到期信息
    let csvDaysToExpiry = daysToExpiry;
    let csvUnderlyingPrice = underlyingPrice;
    
    // 检查是否有原始CSV文本信息
    if (window.rawCSVText) {
        const lines = window.rawCSVText.split('\n');
        if (lines.length > 1) {
            const secondLine = lines[1];
            console.log('CSV第2行内容:', secondLine);
            
            // 改进的到期天数提取 - 支持多种格式
            const daysPatterns = [
                /到期日：.*?(\d+)天到期/,
                /(\d+)天到期/,
                /到期.*?(\d+)天/,
                /(\d+)天/
            ];
            
            for (const pattern of daysPatterns) {
                const daysMatch = secondLine.match(pattern);
                if (daysMatch) {
                    csvDaysToExpiry = parseInt(daysMatch[1]);
                    console.log('✅ 从CSV提取到到期天数:', csvDaysToExpiry, '使用模式:', pattern);
                    break;
                }
            }
            
            // 改进的标的价格检测逻辑
            if (lines.length > 2) {
                console.log('开始检测标的价格...');
                
                // 方法1：从第3行数据推断（如果格式匹配）
                const thirdLine = lines[2];
                const values = thirdLine.split(',').map(v => v.replace(/"/g, '').trim());
                
                if (values.length >= 24) {
                    const strike = parseFloat(values[14]);
                    const delta = parseFloat(values[23]);
                    
                    if (strike > 0 && Math.abs(delta) > 0.3 && Math.abs(delta) < 0.7) {
                        csvUnderlyingPrice = strike;
                        console.log('✅ 方法1成功：从第3行数据推断标的价格:', csvUnderlyingPrice);
                    }
                }
                
                // 方法2：基于Delta=0.5上下期权的加权策略
                if (!csvUnderlyingPrice || csvUnderlyingPrice === underlyingPrice) {
                    console.log('开始使用Delta=0.5加权策略估算标的价格...');
                    
                    // 收集所有看涨期权的Delta和行权价数据
                    const callOptionsData = [];
                    for (let i = 0; i < csvData.length; i++) {
                        const row = csvData[i];
                        if (row && row['行权价'] && row['Delta']) {
                            const strike = parseFloat(row['行权价']);
                            const delta = parseFloat(row['Delta']);
                            
                            if (!isNaN(strike) && !isNaN(delta) && strike > 50 && strike < 2000 && delta > 0) {
                                callOptionsData.push({ strike, delta });
                            }
                        }
                    }
                    
                    if (callOptionsData.length > 0) {
                        console.log(`找到 ${callOptionsData.length} 个看涨期权数据点`);
                        
                        // 按Delta排序
                        callOptionsData.sort((a, b) => a.delta - b.delta);
                        
                        // 寻找Delta=0.5上下最近的期权
                        let upperOption = null;  // Delta > 0.5
                        let lowerOption = null;  // Delta < 0.5
                        
                        // 找到Delta > 0.5的最小值
                        for (const option of callOptionsData) {
                            if (option.delta > 0.5) {
                                upperOption = option;
                                break;
                            }
                        }
                        
                        // 找到Delta < 0.5的最大值
                        for (let i = callOptionsData.length - 1; i >= 0; i--) {
                            if (callOptionsData[i].delta < 0.5) {
                                lowerOption = callOptionsData[i];
                                break;
                            }
                        }
                        
                        console.log('Delta=0.5上下期权:', {
                            upper: upperOption ? `Delta=${upperOption.delta.toFixed(3)}, Strike=${upperOption.strike}` : '无',
                            lower: lowerOption ? `Delta=${lowerOption.delta.toFixed(3)}, Strike=${lowerOption.strike}` : '无'
                        });
                        
                        // 如果找到了上下期权，进行加权计算
                        if (upperOption && lowerOption) {
                            // 计算权重：Delta越接近0.5，权重越大
                            const upperWeight = 1 / Math.abs(upperOption.delta - 0.5);
                            const lowerWeight = 1 / Math.abs(lowerOption.delta - 0.5);
                            const totalWeight = upperWeight + lowerWeight;
                            
                            // 加权平均
                            csvUnderlyingPrice = (upperOption.strike * upperWeight + lowerOption.strike * lowerWeight) / totalWeight;
                            
                            console.log('✅ Delta加权策略成功：', {
                                upperStrike: upperOption.strike,
                                upperDelta: upperOption.delta,
                                upperWeight: upperWeight.toFixed(4),
                                lowerStrike: lowerOption.strike,
                                lowerDelta: lowerOption.delta,
                                lowerWeight: lowerWeight.toFixed(4),
                                totalWeight: totalWeight.toFixed(4),
                                weightedPrice: csvUnderlyingPrice.toFixed(2)
                            });
                            

                            
                        } else if (upperOption || lowerOption) {
                            // 如果只找到一个，直接使用
                            const option = upperOption || lowerOption;
                            csvUnderlyingPrice = option.strike;
                            console.log('✅ 使用单个Delta接近0.5的期权行权价:', csvUnderlyingPrice, 'Delta:', option.delta);
                        } else {
                            console.log('未找到Delta接近0.5的期权，尝试方法3...');
                            
                            // 方法3：从所有期权的中间行权价推断
                            const strikes = callOptionsData.map(opt => opt.strike);
                            strikes.sort((a, b) => a - b);
                            const midIndex = Math.floor(strikes.length / 2);
                            csvUnderlyingPrice = strikes[midIndex];
                            console.log('✅ 方法3成功：从中间行权价推断标的价格:', csvUnderlyingPrice, '可用行权价数量:', strikes.length);
                        }
                    } else {
                        console.log('未找到看涨期权数据，尝试方法3...');
                        
                        // 方法3：从所有期权的中间行权价推断
                        const strikes = [];
                        for (let i = 0; i < csvData.length; i++) {
                            const row = csvData[i];
                            if (row && row['行权价']) {
                                const strike = parseFloat(row['行权价']);
                                if (!isNaN(strike) && strike > 50 && strike < 2000) {
                                    strikes.push(strike);
                                }
                            }
                        }
                        
                        if (strikes.length > 0) {
                            strikes.sort((a, b) => a - b);
                            const midIndex = Math.floor(strikes.length / 2);
                            csvUnderlyingPrice = strikes[midIndex];
                            console.log('✅ 方法3成功：从中间行权价推断标的价格:', csvUnderlyingPrice, '可用行权价数量:', strikes.length);
                        }
                    }
                }
            }
        }
    }
    
                // 更新全局变量
            window.currentUnderlyingPrice = csvUnderlyingPrice;
            window.currentDaysToExpiry = csvDaysToExpiry;
            
            // 更新显示信息
            updateInputFields(csvUnderlyingPrice, csvDaysToExpiry);
    
    // 使用从CSV提取的值
    underlyingPrice = csvUnderlyingPrice;
    daysToExpiry = csvDaysToExpiry;
    
    // 使用从CSV提取的值
    underlyingPrice = csvUnderlyingPrice;
    daysToExpiry = csvDaysToExpiry;
    
    if (csvData.length > 0) {
        console.log('CSV列名:', Object.keys(csvData[0]));
        console.log('第一行数据:', csvData[0]);
        
        // 详细分析列结构
        const headers = Object.keys(csvData[0]);
        console.log('=== CSV列结构分析 ===');
        console.log('总列数:', headers.length);
        
        // 找到包含特定关键词的列
        const deltaCols = headers.filter(col => col.includes('Delta'));
        const midPriceCols = headers.filter(col => col.includes('中间价'));
        const bidCols = headers.filter(col => col.includes('买入价'));
        const askCols = headers.filter(col => col.includes('卖出价'));
        
        console.log('Delta相关列:', deltaCols);
        console.log('中间价相关列:', midPriceCols);
        console.log('买入价相关列:', bidCols);
        console.log('卖出价相关列:', askCols);
        
        // 显示前几列和后几列
        console.log('前5列:', headers.slice(0, 5));
        console.log('后5列:', headers.slice(-5));
        console.log('中间5列:', headers.slice(Math.floor(headers.length/2)-2, Math.floor(headers.length/2)+3));
    }
    
    // 找到行权价列的位置
    let strikeColIndex = -1;
    const headers = Object.keys(csvData[0]);
    
    // 添加调试信息：显示headers数组的完整内容
    console.log('=== Headers数组分析 ===');
    console.log('Headers数组长度:', headers.length);
    console.log('Headers数组内容:', headers);
    console.log('Headers数组索引映射:');
    headers.forEach((header, index) => {
        console.log(`  索引${index}: "${header}"`);
    });
    
    for (let i = 0; i < headers.length; i++) {
        if (headers[i].includes('行权价')) {
            strikeColIndex = i;
            break;
        }
    }
    
    if (strikeColIndex === -1) {
        console.error('❌ 未找到行权价列');
        return [];
    }
    
    console.log(`行权价列位置: 第${strikeColIndex}列`);
    console.log(`行权价列名: ${headers[strikeColIndex]}`);
    
    // 看涨期权列（行权价左边）
    const callCols = headers.slice(0, strikeColIndex);
    // 看跌期权列（行权价右边）
    const putCols = headers.slice(strikeColIndex + 1);
    
    console.log(`看涨期权列数: ${callCols.length}`);
    console.log(`看跌期权列数: ${putCols.length}`);
    
    for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        
            // 跳过空行和标题行
    if (!row[headers[strikeColIndex]] || row[headers[strikeColIndex]].includes('到期日')) {
        console.log(`跳过第${i}行: 行权价列值为 "${row[headers[strikeColIndex]]}"`);
        continue;
    }
        
        console.log(`处理第${i}行:`, {
            行权价: row[headers[strikeColIndex]],
            Delta: row['Delta'],
            'Delta.1': row['Delta.1'],
            中间价: row['中间价'],
            '中间价.1': row['中间价.1']
        });
        
        // 添加更详细的调试信息
        console.log(`第${i}行 - 行权价: ${row[headers[strikeColIndex]]}`);
        console.log(`第${i}行 - 看涨期权列数: ${callCols.length}, 看跌期权列数: ${putCols.length}`);
        console.log(`第${i}行 - 看涨期权列:`, callCols);
        console.log(`第${i}行 - 看跌期权列:`, putCols);
        
        // 显示每列的实际值
        console.log(`第${i}行 - 所有列的值:`);
        headers.forEach((col, colIndex) => {
            const value = row[col];
            if (value && value !== '' && value !== '-') {
                console.log(`  列${colIndex} (${col}): ${value}`);
            }
        });
        
        const strike = parseFloat(row[headers[strikeColIndex]]);
        if (isNaN(strike)) {
            console.warn(`跳过无效行权价的行: ${row[headers[strikeColIndex]]}`);
            continue;
        }

        // --- 解析看涨期权（行权价左边，索引0-13） ---
        let callDelta = null;
        let callMidPrice = null;
        let callBid = null;
        let callAsk = null;
        let callLastPrice = null;
        let callImpliedVol = null;
        let callGamma = null;
        let callTheta = null;
        let callVega = null;
        let callVolume = null;
        let callOpenInterest = null;

        // 智能查找列索引，避免同名列冲突
        const findColumnIndex = (columnName, startIndex = 0, endIndex = headers.length, expectedValue = null) => {
            for (let i = startIndex; i < endIndex; i++) {
                if (headers[i].includes(columnName)) {
                    // 如果指定了期望值，验证该列的数据是否符合预期
                    if (expectedValue !== null) {
                        const value = row[headers[i]];
                        if (value && value !== '' && value !== '-') {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && Math.abs(numValue - expectedValue) < 0.1) {
                                return i; // 找到匹配的列
                            }
                        }
                    } else {
                        return i; // 没有期望值，直接返回第一个匹配的列
                    }
                }
            }
            return -1;
        };
        
        // 添加调试信息：显示当前行的所有列名和值
        console.log(`第${i}行 - 列名和值:`);
        headers.forEach((header, colIndex) => {
            const value = row[header];
            if (value && value !== '' && value !== '-') {
                console.log(`  列${colIndex} (${header}): ${value}`);
            }
        });
        
        // 看涨期权列（行权价左边，索引0到strikeColIndex-1）
        // 使用位置信息来避免同名列冲突
        const callDeltaIndex = findColumnIndex('Delta', 0, strikeColIndex);
        const callMidPriceIndex = findColumnIndex('中间价', 0, strikeColIndex);
        const callBidIndex = findColumnIndex('买入价', 0, strikeColIndex);
        const callAskIndex = findColumnIndex('卖出价', 0, strikeColIndex);
        const callLastPriceIndex = findColumnIndex('最新价', 0, strikeColIndex);
        const callImpliedVolIndex = findColumnIndex('隐含波动率', 0, strikeColIndex);
        const callGammaIndex = findColumnIndex('Gamma', 0, strikeColIndex);
        const callThetaIndex = findColumnIndex('Theta', 0, strikeColIndex);
        const callVegaIndex = findColumnIndex('Vega', 0, strikeColIndex);
        const callVolumeIndex = findColumnIndex('成交量', 0, strikeColIndex);
        const callOpenInterestIndex = findColumnIndex('未平仓数', 0, strikeColIndex);
        
        console.log('看涨期权列索引查找结果:', {
            Delta: callDeltaIndex,
            中间价: callMidPriceIndex,
            买入价: callBidIndex,
            卖出价: callAskIndex,
            最新价: callLastPriceIndex,
            隐含波动率: callImpliedVolIndex,
            Gamma: callGammaIndex,
            Theta: callThetaIndex,
            Vega: callVegaIndex,
            成交量: callVolumeIndex,
            未平仓数: callOpenInterestIndex,
            盈利概率: '盈利概率'
        });
        
        // 使用动态索引访问看涨期权数据
        const callDeltaValue = callDeltaIndex >= 0 ? row[headers[callDeltaIndex]] : null;
        const callMidPriceValue = callMidPriceIndex >= 0 ? row[headers[callMidPriceIndex]] : null;
        const callBidValue = callBidIndex >= 0 ? row[headers[callBidIndex]] : null;
        const callAskValue = callAskIndex >= 0 ? row[headers[callAskIndex]] : null;
        const callLastPriceValue = callLastPriceIndex >= 0 ? row[headers[callLastPriceIndex]] : null;
        const callImpliedVolValue = callImpliedVolIndex >= 0 ? row[headers[callImpliedVolIndex]] : null;
        const callGammaValue = callGammaIndex >= 0 ? row[headers[callGammaIndex]] : null;
        const callThetaValue = callThetaIndex >= 0 ? row[headers[callThetaIndex]] : null;
        const callVegaValue = callVegaIndex >= 0 ? row[headers[callVegaIndex]] : null;
        const callVolumeValue = callVolumeIndex >= 0 ? row[headers[callVolumeIndex]] : null;
        const callOpenInterestValue = callOpenInterestIndex >= 0 ? row[headers[callOpenInterestIndex]] : null;

        console.log(`第${i}行 - 看涨期权数据:`, {
            Delta: callDeltaValue,
            中间价: callMidPriceValue,
            买入价: callBidValue,
            卖出价: callAskValue,
            最新价: callLastPriceValue
        });

        if (callDeltaValue && callDeltaValue !== '' && callDeltaValue !== '-') {
            const delta = parseFloat(callDeltaValue);
            if (!isNaN(delta) && delta > 0) {
                callDelta = delta;
                callMidPrice = parseFloat(callMidPriceValue) || 0;
                callBid = parseFloat(callBidValue) || 0;
                callAsk = parseFloat(callAskValue) || 0;
                callLastPrice = parseFloat(callLastPriceValue) || 0;
                callImpliedVol = parsePercentage(callImpliedVolValue) || 0;
                callGamma = parseFloat(callGammaValue) || 0;
                callTheta = parseFloat(callThetaValue) || 0;
                callVega = parseFloat(callVegaValue) || 0;
                callVolume = parseVolume(callVolumeValue) || 0;
                callOpenInterest = parseVolume(callOpenInterestValue) || 0;
                
                console.log(`第${i}行 - 找到看涨期权Delta: ${delta}`);
            }
        }

        // 放宽验证条件，只要有Delta值就尝试创建期权
        if (callDelta !== null) {
            const callOption = {
                type: 'Call',
                strike: strike,
                strikePrice: strike, // 添加strikePrice字段以保持兼容性
                bid: callBid,
                ask: callAsk,
                lastPrice: callLastPrice,
                midPrice: callMidPrice,
                delta: callDelta,
                gamma: callGamma,
                theta: callTheta,
                vega: callVega,
                impliedVolatility: callImpliedVol,
                volume: callVolume,
                openInterest: callOpenInterest,
                volumeText: callVolumeValue || '0张',
                openInterestText: callOpenInterestValue || '0张',
                profitProbability: (parsePercentage(row[headers[1]]) * 100).toFixed(1) + '%', // 看涨期权盈利概率在索引1
                underlyingPrice: underlyingPrice, // 添加标的价格字段
                daysToExpiry: daysToExpiry, // 添加到期天数字段
                iv: callImpliedVol, // 添加隐含波动率字段
                optionType: 'Call', // 添加期权类型字段
                intrinsic_value: Math.max(0, underlyingPrice - strike),
                timeValue: Math.max(0, callMidPrice - Math.max(0, underlyingPrice - strike)), // 时间价值 = 权利金 - 内在价值
                premium: callMidPrice
            };
            
            console.log(`看涨期权盈利概率: ${row[headers[1]]}, 列索引: 1`);
            
            callOptions.push(callOption);
            options.push(callOption);
            console.log('✅ 添加看涨期权:', callOption);
        }

        // --- 解析看跌期权（行权价右边，索引15-28） ---
        let putDelta = null;
        let putMidPrice = null;
        let putBid = null;
        let putAsk = null;
        let putLastPrice = null;
        let putImpliedVol = null;
        let putGamma = null;
        let putTheta = null;
        let putVega = null;
        let putVolume = null;
        let putOpenInterest = null;

        // 根据CSV结构，看跌期权列索引是固定的（行权价右边，索引15-28）
        const putDeltaIndex = 23;        // Delta
        const putMidPriceIndex = 18;     // 中间价
        const putBidIndex = 15;          // 买入价
        const putAskIndex = 16;          // 卖出价
        const putLastPriceIndex = 19;    // 最新价
        const putImpliedVolIndex = 17;   // 隐含波动率
        const putGammaIndex = 24;        // Gamma
        const putThetaIndex = 25;        // Theta
        const putVegaIndex = 26;         // Vega
        const putVolumeIndex = 21;       // 成交量
        const putOpenInterestIndex = 22; // 未平仓数
        
        // 使用动态索引访问看跌期权数据
        const putDeltaValue = putDeltaIndex >= 0 ? row[headers[putDeltaIndex]] : null;
        const putMidPriceValue = putMidPriceIndex >= 0 ? row[headers[putMidPriceIndex]] : null;
        const putBidValue = putBidIndex >= 0 ? row[headers[putBidIndex]] : null;
        const putAskValue = putAskIndex >= 0 ? row[headers[putAskIndex]] : null;
        const putLastPriceValue = putLastPriceIndex >= 0 ? row[headers[putLastPriceIndex]] : null;
        const putImpliedVolValue = putImpliedVolIndex >= 0 ? row[headers[putImpliedVolIndex]] : null;
        const putGammaValue = putGammaIndex >= 0 ? row[headers[putGammaIndex]] : null;
        const putThetaValue = putThetaIndex >= 0 ? row[headers[putThetaIndex]] : null;
        const putVegaValue = putVegaIndex >= 0 ? row[headers[putVegaIndex]] : null;
        const putVolumeValue = putVolumeIndex >= 0 ? row[headers[putVolumeIndex]] : null;
        const putOpenInterestValue = putOpenInterestIndex >= 0 ? row[headers[putOpenInterestIndex]] : null;
        
        console.log('看跌期权列索引查找结果:', {
            Delta: putDeltaIndex,
            中间价: putMidPriceIndex,
            买入价: putBidIndex,
            卖出价: putAskIndex,
            最新价: putLastPriceIndex,
            隐含波动率: putImpliedVolIndex,
            Gamma: putGammaIndex,
            Theta: putThetaIndex,
            Vega: putVegaIndex,
            成交量: putVolumeIndex,
            未平仓数: putOpenInterestIndex,
            盈利概率: '盈利概率'
        });

        console.log(`第${i}行 - 看跌期权数据:`, {
            Delta: putDeltaValue,
            中间价: putMidPriceValue,
            买入价: putBidValue,
            卖出价: putAskValue,
            最新价: putLastPriceValue
        });

        if (putDeltaValue && putDeltaValue !== '' && putDeltaValue !== '-') {
            const delta = parseFloat(putDeltaValue);
            if (!isNaN(delta) && delta < 0) {
                putDelta = delta;
                putMidPrice = parseFloat(putMidPriceValue) || 0;
                putBid = parseFloat(putBidValue) || 0;
                putAsk = parseFloat(putAskValue) || 0;
                putLastPrice = parseFloat(putLastPriceValue) || 0;
                putImpliedVol = parsePercentage(putImpliedVolValue) || 0;
                putGamma = parseFloat(putGammaValue) || 0;
                putTheta = parseFloat(putThetaValue) || 0;
                putVega = parseFloat(putVegaValue) || 0;
                putVolume = parseVolume(putVolumeValue) || 0;
                putOpenInterest = parseVolume(putOpenInterestValue) || 0;
                
                console.log(`第${i}行 - 找到看跌期权Delta: ${delta}`);
            }
        }

        // 放宽验证条件，只要有Delta值就尝试创建期权
        if (putDelta !== null) {
            const putOption = {
                type: 'Put',
                strike: strike,
                strikePrice: strike, // 添加strikePrice字段以保持兼容性
                bid: putBid || 0,
                ask: putAsk || 0,
                lastPrice: putLastPrice || 0,
                midPrice: putMidPrice,
                delta: putDelta,
                gamma: putGamma || 0,
                theta: putTheta || 0,
                vega: putVega || 0,
                impliedVolatility: putImpliedVol || 0,
                volume: putVolume || 0,
                openInterest: putOpenInterest || 0,
                volumeText: putVolumeValue || '0张',
                openInterestText: putOpenInterestValue || '0张',
                profitProbability: (parsePercentage(row[headers[27]]) * 100).toFixed(1) + '%', // 看跌期权盈利概率在索引27
                underlyingPrice: underlyingPrice, // 添加标的价格字段
                daysToExpiry: daysToExpiry, // 添加到期天数字段
                iv: putImpliedVol, // 添加隐含波动率字段
                optionType: 'Put', // 添加期权类型字段
                intrinsic_value: Math.max(0, strike - underlyingPrice),
                timeValue: Math.max(0, putMidPrice - Math.max(0, strike - underlyingPrice)), // 时间价值 = 权利金 - 内在价值
                premium: putMidPrice
            };
            
            console.log(`看跌期权盈利概率: ${row[headers[27]]}, 列索引: 27`);
            
            putOptions.push(putOption);
            options.push(putOption);
            console.log('✅ 添加看跌期权:', putOption);
        }
    }
    
    console.log('=== CSV处理完成 ===');
    console.log('总期权数量:', options.length);
    console.log('看涨期权数量:', callOptions.length);
    console.log('看跌期权数量:', putOptions.length);
    
    // 显示前几个期权的详细信息
    if (options.length > 0) {
        console.log('前3个期权示例:');
        options.slice(0, 3).forEach((option, index) => {
            console.log(`期权${index + 1}:`, {
                类型: option.type,
                行权价: option.strike,
                Delta: option.delta,
                中间价: option.midPrice,
                隐含波动率: option.impliedVolatility
            });
        });
    }
    
    if (options.length === 0) {
        console.warn('⚠️ 没有找到任何期权数据，可能的原因:');
        console.warn('1. CSV格式与预期不符');
        console.warn('2. 列名不匹配');
        console.warn('3. 数据行被过滤掉');
        console.warn('4. 硬编码的列索引失效');
    }
    
    // 应用Delta过滤
    let deltaMin, deltaMax;
    if (callOptions.length > 0 && putOptions.length > 0) {
        deltaMin = -0.4;
        deltaMax = 0.4;
    } else if (putOptions.length > callOptions.length) {
        deltaMin = -0.4;
        deltaMax = -0.01;
    } else {
        deltaMin = 0.01;
        deltaMax = 0.4;
    }
    
    // 手动过滤期权
    const filteredOptions = options.filter(option => {
        const delta = option.delta;
        const midPrice = option.midPrice;
        
        // Delta范围过滤
        const deltaInRange = delta >= deltaMin && delta <= deltaMax;
        
        // 中间价有效性过滤
        const midPriceValid = midPrice > 0;
        
        if (!deltaInRange) {
            console.log(`过滤掉期权 ${option.type} ${option.strike}: Delta=${delta} 不在范围 [${deltaMin}, ${deltaMax}] 内`);
        }
        
        if (!midPriceValid) {
            console.log(`过滤掉期权 ${option.type} ${option.strike}: 中间价=${midPrice} 无效`);
        }
        
        return deltaInRange && midPriceValid;
    });
    
    console.log(`Delta过滤: ${deltaMin} 到 ${deltaMax}`);
    console.log(`过滤前: ${options.length} 个期权`);
    console.log(`过滤后: ${filteredOptions.length} 个期权`);
    
    // 更新全局变量
    window.callOptions = callOptions;
    window.putOptions = putOptions;
    
    // 返回过滤后的期权数据
    return filteredOptions;
}

// 解析成交量数据（处理"1万张"、"2.5万张"等格式）
function parseVolume(volumeText) {
    if (!volumeText || volumeText === '0张') return 0;
    
    const match = volumeText.match(/(\d+(?:\.\d+)?)(万?)张/);
    if (match) {
        const number = parseFloat(match[1]);
        const unit = match[2];
        return unit === '万' ? number * 10000 : number;
    }
    
    // 尝试直接解析数字
    const number = parseFloat(volumeText);
    return isNaN(number) ? 0 : number;
}

// 解析百分比数据（处理"25.0%"、"0.0%"等格式）
function parsePercentage(percentageText) {
    if (!percentageText || percentageText === '0.0%') return 0;
    
    const match = percentageText.match(/(\d+(?:\.\d+)?)(%)?/);
    if (match) {
        const number = parseFloat(match[1]);
        const unit = match[2];
        return unit === '%' ? number / 100 : number;
    }
    
    return parseFloat(percentageText);
}

// 批量分析所有期权
function analyzeAllOptions() {
    if (importedOptions.length === 0) {
        showError('没有可分析的期权数据');
        return;
    }
    
    // 创建批量分析结果
    const analysisResults = [];
    
    for (const option of importedOptions) {
        try {
            // 将期权数据转换为计算所需的格式
            const inputData = {
                underlying_price: option.underlyingPrice,
                strike_price: option.strikePrice,
                premium: option.premium,
                days_to_expiry: option.daysToExpiry,
                option_type: option.optionType,
                iv: option.iv,
                delta: option.delta,
                gamma: option.gamma,
                theta: option.theta,
                vega: option.vega,
                exercise_prob: null
            };
            
            const result = performCalculations(inputData);
            analysisResults.push(result);
        } catch (error) {
            console.warn('分析期权失败:', option, error);
        }
    }
    
    // 显示批量分析结果
    // 由于删除了输入框，使用全局变量或默认值
    const underlyingPrice = window.currentUnderlyingPrice || 340;
    const daysToExpiry = window.currentDaysToExpiry || 6;
    showBatchAnalysisResults(importedOptions, underlyingPrice, daysToExpiry);
}

// 显示批量分析结果
function showBatchAnalysisResults(options, underlyingPrice, daysToExpiry) {
    console.log('显示批量分析结果...');
    
    const resultsSection = document.getElementById('batch-results');
    if (!resultsSection) {
        console.error('找不到结果显示区域');
        return;
    }
    
    // 分别计算看涨和看跌期权的EV
    const callResults = window.callOptions ? window.callOptions.map(option => {
        const ev = calculateOptionEV(option, underlyingPrice, daysToExpiry);
        return { ...option, ev };
    }) : [];
    
    const putResults = window.putOptions ? window.putOptions.map(option => {
        const ev = calculateOptionEV(option, underlyingPrice, daysToExpiry);
        return { ...option, ev };
    }) : [];
    
    // 过滤后的结果
    const filteredCallResults = callResults.filter(option => {
        const filters = getFilterSettings();
        if (!filters.filterDelta) return true;
        
        const delta = option.delta;
        if (filters.deltaMin !== null && filters.deltaMax !== null) {
            return delta >= filters.deltaMin && delta <= filters.deltaMax;
        } else if (filters.deltaMin !== null) {
            return delta >= filters.deltaMin;
        } else if (filters.deltaMax !== null) {
            return delta <= filters.deltaMax;
        }
        return true;
    });
    
    const filteredPutResults = putResults.filter(option => {
        const filters = getFilterSettings();
        if (!filters.filterDelta) return true;
        
        const delta = option.delta;
        if (filters.deltaMin !== null && filters.deltaMax !== null) {
            return delta >= filters.deltaMin && delta <= filters.deltaMax;
        } else if (filters.deltaMin !== null) {
            return delta >= filters.deltaMin;
        } else if (filters.deltaMax !== null) {
            return delta <= filters.deltaMax;
        }
        return true;
    });
    
    // 生成HTML内容
    let html = `
        <div class="results-header">
            <h3><i class="fas fa-chart-line"></i> 批量期权EV分析结果</h3>
            <div class="results-summary">
                <p><strong>标的价格:</strong> $${underlyingPrice} | <strong>到期天数:</strong> ${daysToExpiry}天</p>
                <p><strong>总期权数:</strong> ${options.length} | <strong>看涨:</strong> ${callResults.length} | <strong>看跌:</strong> ${putResults.length}</p>
                <p><strong>过滤后:</strong> ${filteredCallResults.length + filteredPutResults.length} | <strong>看涨:</strong> ${filteredCallResults.length} | <strong>看跌:</strong> ${filteredPutResults.length}</p>
            </div>
        </div>
    `;
    
    // 看涨期权结果
    if (filteredCallResults.length > 0) {
        html += `
            <div class="call-results">
                <h4><i class="fas fa-arrow-up" style="color: #38a169;"></i> 看涨期权分析结果</h4>
                <div class="table-container">
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>类型</th>
                                <th>行权价</th>
                                <th>Delta</th>
                                <th>中间价</th>
                                <th>内在价值</th>
                                <th>时间价值</th>
                                <th>盈利概率</th>
                                <th>期望价值(EV)</th>
                                <th>风险收益比</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        filteredCallResults.forEach(option => {
            const moneyness = option.strike > underlyingPrice ? '虚值' : 
                             option.strike < underlyingPrice ? '实值' : '平值';
            html += `
                <tr>
                    <td>${option.type}</td>
                    <td>$${option.strike}</td>
                    <td>${option.delta.toFixed(4)}</td>
                    <td>$${option.midPrice.toFixed(2)}</td>
                    <td>$${option.intrinsic_value.toFixed(2)}</td>
                    <td>$${(option.timeValue || (option.premium - option.intrinsic_value)).toFixed(2)}</td>
                    <td>${option.profitProbability}</td>
                    <td class="${option.ev > 0 ? 'positive' : 'negative'}">${option.ev.toFixed(4)}</td>
                    <td>${option.risk_reward_ratio.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // 看跌期权结果
    if (filteredPutResults.length > 0) {
        html += `
            <div class="put-results">
                <h4><i class="fas fa-arrow-down" style="color: #e53e3e;"></i> 看跌期权分析结果</h4>
                <div class="table-container">
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>类型</th>
                                <th>行权价</th>
                                <th>Delta</th>
                                <th>中间价</th>
                                <th>内在价值</th>
                                <th>时间价值</th>
                                <th>盈利概率</th>
                                <th>期望价值(EV)</th>
                                <th>风险收益比</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        filteredPutResults.forEach(option => {
            const moneyness = option.strike < underlyingPrice ? '虚值' : 
                             option.strike > underlyingPrice ? '实值' : '平值';
            html += `
                <tr>
                    <td>${option.type}</td>
                    <td>$${option.strike}</td>
                    <td>${option.delta.toFixed(4)}</td>
                    <td>$${option.midPrice.toFixed(2)}</td>
                    <td>$${option.intrinsic_value.toFixed(2)}</td>
                    <td>$${(option.timeValue || (option.premium - option.intrinsic_value)).toFixed(2)}</td>
                    <td>${option.profitProbability}</td>
                    <td class="${option.ev > 0 ? 'positive' : 'negative'}">${option.ev.toFixed(4)}</td>
                    <td>${option.risk_reward_ratio.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // 添加统计信息
    const allFilteredResults = [...filteredCallResults, ...filteredPutResults];
    if (allFilteredResults.length > 0) {
        const avgEV = allFilteredResults.reduce((sum, opt) => sum + opt.ev, 0) / allFilteredResults.length;
        const positiveEVCount = allFilteredResults.filter(opt => opt.ev > 0).length;
        
        html += `
            <div class="results-stats">
                <h4><i class="fas fa-chart-bar"></i> 统计摘要</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">平均EV值:</span>
                        <span class="stat-value ${avgEV > 0 ? 'positive' : 'negative'}">${avgEV.toFixed(4)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">正EV期权:</span>
                        <span class="stat-value">${positiveEVCount}/${allFilteredResults.length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">正EV比例:</span>
                        <span class="stat-value">${((positiveEVCount / allFilteredResults.length) * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    resultsSection.innerHTML = html;
    // 只有在有内容时才显示
    if (html.trim()) {
        resultsSection.style.display = 'block';
    } else {
        resultsSection.style.display = 'none';
    }
    
    console.log('批量分析结果显示完成');
}

// 获取交易建议
function getRecommendation(ev, riskRewardRatio) {
    if (ev > 0 && riskRewardRatio < 2) {
        return '✅ 推荐';
    } else if (ev > 0 && riskRewardRatio < 3) {
        return '⚠️ 谨慎';
    } else if (ev > 0) {
        return '❌ 高风险';
    } else {
        return '❌ 不推荐';
    }
}

// 清空导入
function clearImport() {
    importedOptions = [];
    document.getElementById('csv-file').value = '';
    document.getElementById('file-name').textContent = '未选择文件';
    document.getElementById('import-btn').disabled = true;
    document.getElementById('import-preview').style.display = 'none';
    
    // 清空全局变量
    window.currentUnderlyingPrice = null;
    window.currentDaysToExpiry = null;
}

// 清除所有数据（包括离线导入和API数据）
function clearAllData() {
    console.log('开始清除所有数据...');
    
    // 清空导入的期权数据
    importedOptions = [];
    window.callOptions = [];
    window.putOptions = [];
    
    // 清空CSV相关
    document.getElementById('csv-file').value = '';
    document.getElementById('file-name').textContent = '未选择文件';
    document.getElementById('import-btn').disabled = true;
    
    // 清空API状态
    const apiStatus = document.getElementById('api-status');
    if (apiStatus) {
        apiStatus.style.display = 'none';
    }
    
    // 清空预览区域
    const importPreview = document.getElementById('import-preview');
    if (importPreview) {
        importPreview.style.display = 'none';
    }
    
    // 清空结果区域
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) {
        resultsSection.style.display = 'none';
    }
    
    // 清空批量分析表格
    const batchTable = document.getElementById('batch-table');
    if (batchTable) {
        batchTable.innerHTML = '';
    }
    
    // 由于删除了输入框，不再重置这些值
    // 系统将通过CSV导入或API获取自动检测这些值
    
    // 清空自动检测信息
    const autoInfo = document.getElementById('auto-info');
    if (autoInfo) {
        autoInfo.style.display = 'none';
    }
    
    // 清空自动过滤信息
    const autoFilterInfo = document.getElementById('auto-filter-info');
    if (autoFilterInfo) {
        autoFilterInfo.style.display = 'none';
    }
    
    // 清空分析计数
    const analysisCount = document.getElementById('analysis-count');
    if (analysisCount) {
        analysisCount.textContent = '0';
    }
    
    console.log('✅ 所有数据已清除');
    
    // 显示成功提示
    showSuccessMessage('所有数据已清除，可以重新开始分析');
}

// 显示成功提示消息
function showSuccessMessage(message) {
    // 创建提示元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
        z-index: 10000;
        font-weight: 600;
        font-size: 0.9rem;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 改进的突破概率计算函数 - 基于正态分布
function calculateBreakProbability(price_ratio, volatility_impact) {
    if (volatility_impact <= 0) return 0.01;
    
    // 标准化价格差距
    const z_score = price_ratio / volatility_impact;
    
    // 使用改进的正态分布近似
    // 基于累积分布函数的近似计算
    let probability;
    
    if (z_score >= 0) {
        // 价格差距大于波动影响，突破概率较低
        probability = 0.5 * Math.exp(-z_score * 1.5);
    } else {
        // 价格差距小于波动影响，突破概率较高
        probability = 0.5 * (1 - Math.exp(z_score * 1.5));
    }
    
    // 确保概率在合理范围内
    return Math.max(0.01, Math.min(0.99, probability));
}

// 风险调整函数 - 基于市场条件动态调整
function calculateRiskAdjustment(underlying_price, iv, T, delta, gamma, option_type, moneyness) {
    // 基础风险系数
    let base_risk = 0.1;
    
    // 根据期权状态调整风险
    if (moneyness === "实值") {
        base_risk = 0.15; // 实值期权风险更高
    } else if (moneyness === "平值") {
        base_risk = 0.12; // 平值期权风险中等
    }
    
    // 根据波动率调整风险
    if (iv > 0.5) { // 高波动率
        base_risk *= 1.2;
    } else if (iv < 0.2) { // 低波动率
        base_risk *= 0.8;
    }
    
    // 根据时间调整风险
    if (T > 0.5) { // 长期期权
        base_risk *= 1.1;
    } else if (T < 0.1) { // 短期期权
        base_risk *= 0.9;
    }
    
    return base_risk;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，开始初始化...');
    
    // 确保结果区域在页面加载时是隐藏的
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) {
        resultsSection.style.display = 'none';
        console.log('✅ 结果区域已设置为隐藏状态');
    }
    
    // 初始化全局变量
    window.currentUnderlyingPrice = 340;
    window.currentDaysToExpiry = 6;
    console.log('全局变量初始化完成');
    
    // 设置默认值
    setDefaultValues();
    console.log('默认值设置完成');
    
    // 添加输入验证
    addInputValidation();
    console.log('输入验证设置完成');
    
    // 添加自动计算行权概率功能
    addAutoCalculation();
    console.log('自动计算功能设置完成');

    // 设置CSV导入功能
    setupCSVImport();
    console.log('CSV导入功能设置完成');
    
    // 绑定清除所有数据按钮事件
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllData);
        console.log('✅ 清除所有数据按钮事件绑定完成');
    }
    
    console.log('所有初始化完成！');
});

// 设置默认值
function setDefaultValues() {
    console.log('开始设置默认值...');
    
    // 由于删除了输入框，这里不再设置默认值
    // 系统将通过CSV导入或API获取自动检测这些值
    console.log('基础参数输入框已删除，系统将自动检测标的价格和到期天数');
}

// 添加输入验证
function addInputValidation() {
    console.log('设置输入验证...');
    
    const inputs = document.querySelectorAll('input[type="number"]');
    console.log(`找到 ${inputs.length} 个数字输入框`);
    
    if (inputs.length > 0) {
        inputs.forEach(input => {
            input.addEventListener('input', function() {
                validateInput(this);
            });
        });
        console.log('✅ 输入验证功能已设置');
    } else {
        console.log('⚠️ 未找到数字输入框，跳过输入验证设置');
    }
}

// 验证输入
function validateInput(input) {
    const value = parseFloat(input.value);
    
    if (input.value === '') return;
    
    if (isNaN(value)) {
        input.style.borderColor = '#e53e3e';
        return false;
    }
    
    input.style.borderColor = '#e2e8f0';
    return true;
}

// 添加自动计算行权概率功能
function addAutoCalculation() {
    console.log('设置自动计算功能...');
    
    // 检查是否存在相关元素，如果不存在则跳过
    const deltaInput = document.getElementById('delta');
    const exerciseProbInput = document.getElementById('exercise_prob');
    
    if (deltaInput && exerciseProbInput) {
        deltaInput.addEventListener('input', function() {
            if (exerciseProbInput.value === '') {
                const delta = parseFloat(this.value);
                if (!isNaN(delta)) {
                    // 使用Delta的绝对值来计算行权概率
                    const estimatedProb = Math.max(0.01, Math.min(0.99, Math.abs(delta))) * 100;
                    exerciseProbInput.placeholder = `自动计算: ${estimatedProb.toFixed(1)}%`;
                    
                    // 添加提示信息
                    if (delta < 0) {
                        console.log('检测到负Delta值，这通常是看跌期权');
                    } else if (delta > 0) {
                        console.log('检测到正Delta值，这通常是看涨期权');
                    }
                }
            }
        });
        console.log('✅ 自动计算功能已设置');
    } else {
        console.log('⚠️ 跳过自动计算功能设置（相关元素不存在）');
    }
}

// 主计算函数
function calculateEV() {
    // 获取输入值
    const inputs = getInputValues();
    
    // 调试信息：显示所有输入值
    console.log('调试信息 - 所有输入值:', inputs);
    
    // 验证输入
    try {
        if (!validateAllInputs(inputs)) {
            showError('请检查输入参数是否正确');
            return;
        }
    } catch (error) {
        showError(error.message);
        return;
    }
    
    // 执行计算
    try {
        const results = performCalculations(inputs);
        currentResults = results;
        
        // 显示结果
        displayResults(results);
        
        // 显示结果区域
        document.getElementById('results-section').style.display = 'block';
        
        // 滚动到结果区域
        document.getElementById('results-section').scrollIntoView({ 
            behavior: 'smooth' 
        });
        
    } catch (error) {
        showError('计算过程中出现错误: ' + error.message);
    }
}

// 获取输入值
function getInputValues() {
    return {
        underlying_price: parseFloat(document.getElementById('underlying_price').value),
        strike_price: parseFloat(document.getElementById('strike_price').value),
        premium: parseFloat(document.getElementById('premium').value),
        days_to_expiry: parseInt(document.getElementById('days_to_expiry').value),
        option_type: document.querySelector('input[name="option_type"]:checked').value,
        iv: parseFloat(document.getElementById('iv').value) / 100,
        delta: parseFloat(document.getElementById('delta').value),
        gamma: parseFloat(document.getElementById('gamma').value),
        theta: parseFloat(document.getElementById('theta').value),
        vega: parseFloat(document.getElementById('vega').value),
        exercise_prob: document.getElementById('exercise_prob').value ? 
            parseFloat(document.getElementById('exercise_prob').value) / 100 : null
    };
}

// 验证所有输入
function validateAllInputs(inputs) {
    const requiredFields = [
        'underlying_price', 'strike_price', 'premium', 'days_to_expiry', 'iv',
        'gamma', 'vega'
    ];
    
    // 检查必填字段
    for (let field of requiredFields) {
        if (isNaN(inputs[field]) || inputs[field] <= 0) {
            const fieldNames = {
                'underlying_price': '标的当前价格',
                'strike_price': '期权行权价',
                'premium': '收到的权利金',
                'days_to_expiry': '剩余到期天数',
                'iv': '隐含波动率',
                'gamma': 'Gamma',
                'vega': 'Vega'
            };
            throw new Error(`${fieldNames[field] || field} 必须大于0，当前值: ${inputs[field]}`);
        }
    }
    
    // 特殊处理Delta（看跌期权为负值）
    if (isNaN(inputs.delta)) {
        throw new Error(`Delta 不能为空，当前值: ${inputs.delta}`);
    }
    
    // 特殊处理Theta（通常为负数）
    if (isNaN(inputs.theta)) {
        throw new Error(`Theta 不能为空，当前值: ${inputs.theta}`);
    }
    
    if (inputs.days_to_expiry <= 0 || inputs.days_to_expiry > 365) {
        throw new Error(`剩余到期天数必须在1-365天之间，当前值: ${inputs.days_to_expiry}`);
    }
    
    if (inputs.iv <= 0 || inputs.iv > 5) { // 最大500%波动率
        throw new Error(`隐含波动率必须在0-500%之间，当前值: ${(inputs.iv * 100).toFixed(1)}%`);
    }
    
    return true;
}

// 执行计算
function performCalculations(inputs) {
    const T = inputs.days_to_expiry / 252.0;
    
    // 判断期权状态
    let moneyness, intrinsic_value, price_diff;
    
    if (inputs.option_type === 'call') {
        if (inputs.strike_price > inputs.underlying_price) {
            moneyness = "虚值";
            intrinsic_value = 0;
            price_diff = inputs.strike_price - inputs.underlying_price;
        } else if (inputs.strike_price < inputs.underlying_price) {
            moneyness = "实值";
            intrinsic_value = inputs.underlying_price - inputs.strike_price;
            price_diff = 0;
        } else {
            moneyness = "平值";
            intrinsic_value = 0;
            price_diff = 0;
        }
    } else {
        if (inputs.strike_price < inputs.underlying_price) {
            moneyness = "虚值";
            intrinsic_value = 0;
            price_diff = inputs.underlying_price - inputs.strike_price;
        } else if (inputs.strike_price > inputs.underlying_price) {
            moneyness = "实值";
            intrinsic_value = inputs.strike_price - inputs.underlying_price;
            price_diff = 0;
        } else {
            moneyness = "平值";
            intrinsic_value = 0;
            price_diff = 0;
        }
    }
    
    // 计算行权概率
    let exercise_prob;
    if (inputs.exercise_prob !== null) {
        exercise_prob = inputs.exercise_prob;
    } else {
        // 使用改进的行权概率计算：Delta 80% + 盈利概率 20%
        // 注意：这里我们假设盈利概率为Delta的近似值，实际使用时应该传入真实的盈利概率
        const estimatedProfitProb = Math.abs(inputs.delta) * 0.5; // 估算盈利概率
        exercise_prob = calculateExerciseProbability(inputs.delta, estimatedProfitProb * 100);
    }
    
    const no_exercise_prob = 1 - exercise_prob;
    
    // 计算潜在赔付 - 改进版本
    let potential_payout, break_probability;
    
    if (inputs.option_type === 'call') {
        if (moneyness === "虚值") {
            // 虚值看涨期权：基于正态分布和风险中性定价
            const break_even_price = inputs.strike_price;
            const price_ratio = (break_even_price - inputs.underlying_price) / inputs.underlying_price;
            const volatility_impact = inputs.iv * Math.sqrt(T);
            
            // 改进的突破概率计算：基于正态分布
            break_probability = calculateBreakProbability(price_ratio, volatility_impact);
            
            // 改进的赔付计算：基于风险中性定价和Delta风险
            const delta_risk = Math.abs(inputs.delta) * inputs.underlying_price * 0.1; // 10%价格变动风险
            const gamma_risk = inputs.gamma * inputs.underlying_price * inputs.underlying_price * 0.01; // 1%价格变动风险
            const volatility_risk = inputs.underlying_price * inputs.iv * Math.sqrt(T) * Math.abs(inputs.delta);
            
            // 综合风险计算
            potential_payout = Math.max(0, delta_risk + gamma_risk + volatility_risk * break_probability);
            
        } else {
            // 实值看涨期权：内在价值 + 动态风险调整
            const delta_risk = Math.abs(inputs.delta) * inputs.underlying_price * 0.15; // 15%价格变动风险
            const gamma_risk = inputs.gamma * inputs.underlying_price * inputs.underlying_price * 0.02; // 2%价格变动风险
            const volatility_risk = inputs.underlying_price * inputs.iv * Math.sqrt(T) * Math.abs(inputs.delta) * 0.5;
            
            potential_payout = intrinsic_value + delta_risk + gamma_risk + volatility_risk;
        }
    } else {
        if (moneyness === "虚值") {
            // 虚值看跌期权：基于正态分布和风险中性定价
            const break_even_price = inputs.strike_price;
            const price_ratio = (inputs.underlying_price - break_even_price) / inputs.underlying_price;
            const volatility_impact = inputs.iv * Math.sqrt(T);
            
            // 改进的突破概率计算：基于正态分布
            break_probability = calculateBreakProbability(price_ratio, volatility_impact);
            
            // 改进的赔付计算：基于风险中性定价和Delta风险
            const delta_risk = Math.abs(inputs.delta) * inputs.underlying_price * 0.1; // 10%价格变动风险
            const gamma_risk = inputs.gamma * inputs.underlying_price * inputs.underlying_price * 0.01; // 1%价格变动风险
            const volatility_risk = inputs.underlying_price * inputs.iv * Math.sqrt(T) * Math.abs(inputs.delta);
            
            // 综合风险计算
            potential_payout = Math.max(0, delta_risk + gamma_risk + volatility_risk * break_probability);
            
        } else {
            // 实值看跌期权：内在价值 + 动态风险调整
            const delta_risk = Math.abs(inputs.delta) * inputs.underlying_price * 0.15; // 15%价格变动风险
            const gamma_risk = inputs.gamma * inputs.underlying_price * inputs.underlying_price * 0.02; // 2%价格变动风险
            const volatility_risk = inputs.underlying_price * inputs.iv * Math.sqrt(T) * Math.abs(inputs.delta) * 0.5;
            
            potential_payout = intrinsic_value + delta_risk + gamma_risk + volatility_risk;
        }
    }
    
    // 计算EV
    const premium_component = inputs.premium * no_exercise_prob;
    const payout_component = potential_payout * exercise_prob;
    const ev = premium_component - payout_component;
    
    // 计算风险收益比
    const risk_reward_ratio = potential_payout / inputs.premium;
    
    return {
        ...inputs,
        T,
        moneyness,
        intrinsic_value,
        price_diff,
        exercise_prob,
        no_exercise_prob,
        break_probability,
        potential_payout,
        premium_component,
        payout_component,
        ev,
        risk_reward_ratio
    };
}

// 显示结果
function displayResults(results) {
    // 输入参数汇总
    displayInputSummary(results);
    
    // 期权分析
    displayOptionAnalysis(results);
    
    // 希腊字母数据
    displayGreekData(results);
    
    // 行权概率分析
    displayProbabilityAnalysis(results);
    
    // 潜在赔付计算
    displayPayoutCalculation(results);
    
    // EV计算
    displayEVCalculation(results);
    
    // 结果汇总
    displayFinalResults(results);
    
    // 交易建议
    displayTradingAdvice(results);
    
    // 风险管理
    displayRiskManagement(results);
}

// 显示输入参数汇总
function displayInputSummary(results) {
    const container = document.getElementById('input-summary');
    container.innerHTML = `
        <div class="result-item">
            <div class="result-label">标的当前价格</div>
            <div class="result-value">$${results.underlying_price.toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">期权行权价</div>
            <div class="result-value">$${results.strike_price.toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">收到的权利金</div>
            <div class="result-value">$${results.premium.toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">剩余到期天数</div>
            <div class="result-value">${results.days_to_expiry} 天</div>
        </div>
        <div class="result-item">
            <div class="result-label">期权类型</div>
            <div class="result-value">${results.option_type === 'call' ? '看涨期权 (CALL)' : '看跌期权 (PUT)'}</div>
        </div>
        <div class="result-item">
            <div class="result-label">隐含波动率</div>
            <div class="result-value">${(results.iv * 100).toFixed(1)}%</div>
        </div>
    `;
}

// 显示期权分析
function displayOptionAnalysis(results) {
    const container = document.getElementById('option-analysis');
    container.innerHTML = `
        <div class="result-item">
            <div class="result-label">期权状态</div>
            <div class="result-value">${results.moneyness}</div>
        </div>
        <div class="result-item">
            <div class="result-label">内在价值</div>
            <div class="result-value">$${results.intrinsic_value.toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">时间价值</div>
            <div class="result-value">$${(results.premium - results.intrinsic_value).toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">年化时间</div>
            <div class="result-value">${results.T.toFixed(4)} 年</div>
        </div>
    `;
}

// 显示希腊字母数据
function displayGreekData(results) {
    const container = document.getElementById('greek-data');
    container.innerHTML = `
        <div class="result-item">
            <div class="result-label">Delta</div>
            <div class="result-value">${results.delta.toFixed(3)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">Gamma</div>
            <div class="result-value">${results.gamma.toFixed(4)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">Theta</div>
            <div class="result-value">${results.theta.toFixed(4)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">Vega</div>
            <div class="result-value">${results.vega.toFixed(4)}</div>
        </div>
    `;
}

// 显示行权概率分析
function displayProbabilityAnalysis(results) {
    const container = document.getElementById('probability-analysis');
    container.innerHTML = `
        <div class="result-item">
            <div class="result-label">行权概率</div>
            <div class="result-value">${(results.exercise_prob * 100).toFixed(1)}%</div>
        </div>
        <div class="result-item">
            <div class="result-label">不行权概率</div>
            <div class="result-value">${(results.no_exercise_prob * 100).toFixed(1)}%</div>
        </div>
    `;
}

// 显示潜在赔付计算
function displayPayoutCalculation(results) {
    const container = document.getElementById('payout-calculation');
    
    let content = '';
    if (results.option_type === 'call') {
        if (results.moneyness === "虚值") {
            const break_even_price = results.strike_price;
            const price_ratio = (break_even_price - results.underlying_price) / results.underlying_price;
            const volatility_impact = results.iv * Math.sqrt(results.T);
            
            content = `
                <p><strong>虚值看涨期权分析:</strong></p>
                <p>突破价格: $${results.strike_price.toFixed(2)}</p>
                <p>当前价格: $${results.underlying_price.toFixed(2)}</p>
                <p>价格差距: $${(results.strike_price - results.underlying_price).toFixed(2)}</p>
                <p>年化时间: ${results.T.toFixed(4)} 年</p>
                <p>隐含波动率: ${(results.iv * 100).toFixed(1)}%</p>
                <p>价格比例: ${(price_ratio * 100).toFixed(2)}%</p>
                <p>波动影响: ${(volatility_impact * 100).toFixed(2)}%</p>
                <p>估算突破概率: ${results.break_probability ? (results.break_probability * 100).toFixed(2) + '%' : 'N/A'}</p>
                <hr>
                <p><strong>风险分解:</strong></p>
                <p>Delta风险: $${(Math.abs(results.delta) * results.underlying_price * 0.1).toFixed(2)}</p>
                <p>Gamma风险: $${(results.gamma * results.underlying_price * results.underlying_price * 0.01).toFixed(2)}</p>
                <p>波动率风险: $${(results.underlying_price * results.iv * Math.sqrt(results.T) * Math.abs(results.delta)).toFixed(2)}</p>
                <p><strong>总预期赔付: $${results.potential_payout.toFixed(2)}</strong></p>
            `;
        } else {
            const delta_risk = Math.abs(results.delta) * results.underlying_price * 0.15;
            const gamma_risk = results.gamma * results.underlying_price * results.underlying_price * 0.02;
            const volatility_risk = results.underlying_price * results.iv * Math.sqrt(results.T) * Math.abs(results.delta) * 0.5;
            
            content = `
                <p><strong>实值看涨期权分析:</strong></p>
                <p>内在价值: $${results.intrinsic_value.toFixed(2)}</p>
                <p>Delta风险: $${delta_risk.toFixed(2)}</p>
                <p>Gamma风险: $${gamma_risk.toFixed(2)}</p>
                <p>波动率风险: $${volatility_risk.toFixed(2)}</p>
                <p><strong>总预期赔付: $${results.potential_payout.toFixed(2)}</strong></p>
            `;
        }
    } else {
        if (results.moneyness === "虚值") {
            const break_even_price = results.strike_price;
            const price_ratio = (results.underlying_price - break_even_price) / results.underlying_price;
            const volatility_impact = results.iv * Math.sqrt(results.T);
            
            content = `
                <p><strong>虚值看跌期权分析:</strong></p>
                <p>突破价格: $${results.strike_price.toFixed(2)}</p>
                <p>当前价格: $${results.underlying_price.toFixed(2)}</p>
                <p>价格差距: $${(results.underlying_price - results.strike_price).toFixed(2)}</p>
                <p>年化时间: ${results.T.toFixed(4)} 年</p>
                <p>隐含波动率: ${(results.iv * 100).toFixed(1)}%</p>
                <p>价格比例: ${(price_ratio * 100).toFixed(2)}%</p>
                <p>波动影响: ${(volatility_impact * 100).toFixed(2)}%</p>
                <p>估算突破概率: ${results.break_probability ? (results.break_probability * 100).toFixed(2) + '%' : 'N/A'}</p>
                <hr>
                <p><strong>风险分解:</strong></p>
                <p>Delta风险: $${(Math.abs(results.delta) * results.underlying_price * 0.1).toFixed(2)}</p>
                <p>Gamma风险: $${(results.gamma * results.underlying_price * results.underlying_price * 0.01).toFixed(2)}</p>
                <p>波动率风险: $${(results.underlying_price * results.iv * Math.sqrt(results.T) * Math.abs(results.delta)).toFixed(2)}</p>
                <p><strong>总预期赔付: $${results.potential_payout.toFixed(2)}</strong></p>
            `;
        } else {
            const delta_risk = Math.abs(results.delta) * results.underlying_price * 0.15;
            const gamma_risk = results.gamma * results.underlying_price * results.underlying_price * 0.02;
            const volatility_risk = results.underlying_price * results.iv * Math.sqrt(results.T) * Math.abs(results.delta) * 0.5;
            
            content = `
                <p><strong>实值看跌期权分析:</strong></p>
                <p>内在价值: $${results.intrinsic_value.toFixed(2)}</p>
                <p>Delta风险: $${delta_risk.toFixed(2)}</p>
                <p>Gamma风险: $${gamma_risk.toFixed(2)}</p>
                <p>波动率风险: $${volatility_risk.toFixed(2)}</p>
                <p><strong>总预期赔付: $${results.potential_payout.toFixed(2)}</strong></p>
            `;
        }
    }
    
    container.innerHTML = content;
}

// 显示EV计算
function displayEVCalculation(results) {
    const container = document.getElementById('ev-calculation');
    container.innerHTML = `
        <p><strong>公式:</strong> EV = (权利金 × 不行权概率) - (潜在赔付 × 行权概率)</p>
        <p><strong>计算:</strong> EV = ($${results.premium.toFixed(2)} × ${(results.no_exercise_prob * 100).toFixed(1)}%) - ($${results.potential_payout.toFixed(2)} × ${(results.exercise_prob * 100).toFixed(1)}%)</p>
        <p><strong>权利金收益:</strong> $${results.premium.toFixed(2)} × ${(results.no_exercise_prob * 100).toFixed(1)}% = $${results.premium_component.toFixed(2)}</p>
        <p><strong>赔付损失:</strong> $${results.potential_payout.toFixed(2)} × ${(results.exercise_prob * 100).toFixed(1)}% = $${results.payout_component.toFixed(2)}</p>
        <p><strong>预期价值:</strong> $${results.premium_component.toFixed(2)} - $${results.payout_component.toFixed(2)} = $${results.ev.toFixed(2)}</p>
    `;
}

// 显示结果汇总
function displayFinalResults(results) {
    const container = document.getElementById('final-results');
    container.innerHTML = `
        <div class="result-item">
            <div class="result-label">期权类型</div>
            <div class="result-value">${results.option_type === 'call' ? '看涨期权 (CALL)' : '看跌期权 (PUT)'}</div>
        </div>
        <div class="result-item">
            <div class="result-label">期权状态</div>
            <div class="result-value">${results.moneyness}</div>
        </div>
        <div class="result-item">
            <div class="result-label">内在价值</div>
            <div class="result-value">$${results.intrinsic_value.toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">时间价值</div>
            <div class="result-value">$${(results.premium - results.intrinsic_value).toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">预期潜在赔付</div>
            <div class="result-value">$${results.potential_payout.toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">不行权概率</div>
            <div class="result-value">${(results.no_exercise_prob * 100).toFixed(1)}%</div>
        </div>
        <div class="result-item">
            <div class="result-label">行权概率</div>
            <div class="result-value">${(results.exercise_prob * 100).toFixed(1)}%</div>
        </div>
        <div class="result-item">
            <div class="result-label">预期价值(EV)</div>
            <div class="result-value ${results.ev > 0 ? 'positive' : 'negative'}">$${results.ev.toFixed(2)}</div>
        </div>
        <div class="result-item">
            <div class="result-label">风险收益比</div>
            <div class="result-value">${results.risk_reward_ratio.toFixed(2)}</div>
        </div>
    `;
}

// 显示交易建议
function displayTradingAdvice(results) {
    const container = document.getElementById('trading-advice');
    
    let content = '';
    if (results.ev > 0) {
        content += `
            <div class="highlight">
                <h4>✅ 结论: 该期权合约预期价值为正 ($${results.ev.toFixed(2)})</h4>
                <p>📈 预期收益: 每张合约平均盈利 $${results.ev.toFixed(2)}</p>
            </div>
        `;
        
        // 风险评估
        if (results.risk_reward_ratio > 3) {
            content += `<p class="warning">⚠️ 高风险: 风险收益比 ${results.risk_reward_ratio.toFixed(2)} 过高</p>`;
        } else if (results.risk_reward_ratio > 2) {
            content += `<p class="warning">⚠️ 中等风险: 风险收益比 ${results.risk_reward_ratio.toFixed(2)} 较高</p>`;
        } else {
            content += `<p class="positive">✅ 风险可控: 风险收益比 ${results.risk_reward_ratio.toFixed(2)} 合理</p>`;
        }
    } else {
        content += `
            <div class="highlight">
                <h4>❌ 结论: 该期权合约预期价值为负 ($${Math.abs(results.ev).toFixed(2)})</h4>
                <p>📉 预期损失: 每张合约平均亏损 $${Math.abs(results.ev).toFixed(2)}</p>
            </div>
        `;
    }
    
    // 策略建议
    content += `<h4>🎯 策略建议:</h4>`;
    if (results.ev > 0 && results.risk_reward_ratio < 2) {
        content += `
            <ul>
                <li>可以考虑卖出，风险收益比合理</li>
                <li>建议设置止损，控制最大损失</li>
                <li>关注市场变化，及时调整策略</li>
            </ul>
        `;
    } else if (results.ev > 0 && results.risk_reward_ratio >= 2) {
        content += `
            <ul>
                <li>虽然EV为正，但风险较大</li>
                <li>建议减少仓位或选择其他合约</li>
                <li>必须设置严格止损</li>
            </ul>
        `;
    } else {
        content += `
            <ul>
                <li>不建议卖出，风险过高</li>
                <li>考虑买入期权或选择其他策略</li>
                <li>等待更好的交易机会</li>
            </ul>
        `
    }
    
    container.innerHTML = content;
}

// 显示风险管理
function displayRiskManagement(results) {
    const container = document.getElementById('risk-management');
    const stopLossPrice = results.underlying_price * (1 + results.iv * Math.sqrt(results.T));
    const maxPosition = Math.min(5, Math.max(1, 10 / results.risk_reward_ratio));
    
    container.innerHTML = `
        <ul>
            <li><strong>设置止损价格:</strong> $${stopLossPrice.toFixed(2)}</li>
            <li><strong>最大仓位:</strong> 建议不超过账户的 ${maxPosition.toFixed(0)}%</li>
            <li><strong>监控指标:</strong> Delta变化、隐含波动率变化、时间衰减</li>
        </ul>
    `;
}

// 显示错误信息
function showError(message) {
    // 在控制台显示详细错误信息
    console.error('详细错误信息:', message);
    
    // 显示用户友好的错误提示
    const errorMessage = `输入验证失败！\n\n${message}\n\n请检查以下字段：\n• 所有数值字段不能为空\n• 价格和天数必须大于0\n• 波动率必须在0-500%之间\n• Delta可以为负值（看跌期权）\n• Theta可以为负值（时间衰减）`;
    
    alert(errorMessage);
}

// 清空结果
function clearResults() {
    document.getElementById('results-section').style.display = 'none';
    currentResults = {};
}

// 重置表单
function resetForm() {
    document.getElementById('underlying_price').value = '';
    document.getElementById('strike_price').value = '';
    document.getElementById('premium').value = '';
    document.getElementById('days_to_expiry').value = '';
    document.getElementById('iv').value = '';
    document.getElementById('delta').value = '';
    document.getElementById('gamma').value = '';
    document.getElementById('theta').value = '';
    document.getElementById('vega').value = '';
    document.getElementById('exercise_prob').value = '';
    
    clearResults();
}

// 自动设置Delta范围默认值
function autoSetDeltaRange(options) {
    console.log('=== 开始自动设置Delta范围 ===');
    
    if (!options || options.length === 0) {
        console.log('没有期权数据，跳过自动设置');
        return;
    }
    
    // 统计看涨和看跌期权数量
    let callCount = 0;
    let putCount = 0;
    
    options.forEach(option => {
        if (option.type === 'Call') {
            callCount++;
        } else if (option.type === 'Put') {
            putCount++;
        }
    });
    
    console.log(`期权统计：看涨 ${callCount} 个，看跌 ${putCount} 个`);
    
    // 根据期权类型设置合适的Delta范围
    let deltaMin, deltaMax;
    
    if (callCount > 0 && putCount > 0) {
        // 同时有看涨和看跌期权，设置两个范围
        deltaMin = -0.4;
        deltaMax = 0.4;
        console.log('同时有看涨和看跌期权，设置Delta范围：-0.4 到 0.4');
    } else if (putCount > callCount) {
        // 主要是看跌期权，设置负Delta范围
        deltaMin = -0.4;
        deltaMax = -0.01;
        console.log('主要看跌期权，设置Delta范围：-0.4 到 -0.01');
    } else if (callCount > putCount) {
        // 主要是看涨期权，设置正Delta范围
        deltaMin = 0.01;
        deltaMax = 0.4;
        console.log('主要看涨期权，设置Delta范围：0.01 到 0.4');
    } else {
        // 没有期权数据，不设置
        console.log('没有有效期权数据，不设置Delta范围');
        return;
    }
    
    // 存储过滤设置到全局变量
    window.currentFilterSettings = {
        filterDelta: true,
        deltaMin: deltaMin,
        deltaMax: deltaMax
    };
    
    // 显示自动设置信息
    let optionType, deltaRange;
    if (callCount > 0 && putCount > 0) {
        optionType = '看涨和看跌期权';
        deltaRange = '-0.4 到 0.4';
    } else if (putCount > callCount) {
        optionType = '看跌期权';
        deltaRange = '-0.4 到 -0.01';
    } else {
        optionType = '看涨期权';
        deltaRange = '0.01 到 0.4';
    }
    
    showAutoSetInfo(optionType, deltaRange, putCount, callCount);
    
    console.log('=== Delta范围自动设置完成 ===');
}

function getFilterSettings() {
    // 使用全局存储的过滤设置
    if (window.currentFilterSettings) {
        return window.currentFilterSettings;
    }
    
    // 如果没有全局设置，根据期权类型自动设置
    const callCount = window.callOptions ? window.callOptions.length : 0;
    const putCount = window.putOptions ? window.putOptions.length : 0;
    
    let deltaMin, deltaMax;
    if (callCount > 0 && putCount > 0) {
        deltaMin = -0.4;
        deltaMax = 0.4;
    } else if (putCount > callCount) {
        deltaMin = -0.4;
        deltaMax = -0.01;
    } else {
        deltaMin = 0.01;
        deltaMax = 0.4;
    }
    
    // 默认设置
    return {
        filterDelta: true,
        deltaMin: deltaMin,
        deltaMax: deltaMax
    };
}

// 显示自动设置信息
function showAutoSetInfo(optionType, deltaRange, putCount, callCount) {
    console.log('显示自动设置信息:', { optionType, deltaRange, putCount, callCount });
    
    // 查找或创建信息显示区域
    let infoDiv = document.querySelector('.auto-set-info');
    if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.className = 'auto-set-info';
        infoDiv.style.cssText = `
            margin-top: 15px;
            padding: 15px;
            background: #e6f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 8px;
            font-size: 0.9rem;
            color: #0066cc;
        `;
        
        const filterSystem = document.querySelector('.filter-system');
        if (filterSystem) {
            filterSystem.appendChild(infoDiv);
        }
    }
    
    // 根据期权类型生成不同的信息
    let infoContent = '';
    
    if (putCount > 0 && callCount > 0) {
        infoContent = `
            <div style="text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #0066cc;">
                    <i class="fas fa-check-circle"></i> 自动设置完成！
                </h4>
                <p style="margin: 5px 0; font-weight: 500;">
                    检测到 <span style="color: #e53e3e; font-weight: 600;">${putCount} 个看跌期权</span>, 
                    <span style="color: #38a169; font-weight: 600;">${callCount} 个看涨期权</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    主要类型: <span style="color: #0066cc; font-weight: 600;">${optionType}</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    自动设置Delta范围: <span style="color: #0066cc; font-weight: 600;">${deltaRange}</span>
                </p>
                <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                    这个范围覆盖了看涨和看跌期权，适合卖方策略，风险相对可控
                </p>
            </div>
        `;
    } else if (putCount > 0) {
        infoContent = `
            <div style="text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #0066cc;">
                    <i class="fas fa-check-circle"></i> 自动设置完成！
                </h4>
                <p style="margin: 5px 0; font-weight: 500;">
                    检测到 <span style="color: #e53e3e; font-weight: 600;">${putCount} 个看跌期权</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    主要类型: <span style="color: #0066cc; font-weight: 600;">${optionType}</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    自动设置Delta范围: <span style="color: #0066cc; font-weight: 600;">${deltaRange}</span>
                </p>
                <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                    这个范围适合看跌期权卖方策略，风险相对可控
                </p>
            </div>
        `;
    } else if (callCount > 0) {
        infoContent = `
            <div style="text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #0066cc;">
                    <i class="fas fa-check-circle"></i> 自动设置完成！
                </h4>
                <p style="margin: 5px 0; font-weight: 500;">
                    检测到 <span style="color: #38a169; font-weight: 600;">${callCount} 个看涨期权</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    主要类型: <span style="color: #0066cc; font-weight: 600;">${optionType}</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    自动设置Delta范围: <span style="color: #0066cc; font-weight: 600;">${deltaRange}</span>
                </p>
                <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                    这个范围适合看涨期权卖方策略，风险相对可控
                </p>
            </div>
        `;
    } else {
        infoContent = `
            <div style="text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #e53e3e;">
                    <i class="fas fa-exclamation-triangle"></i> 未检测到有效期权
                </h4>
                <p style="margin: 5px 0; color: #666;">
                    请检查CSV文件格式是否正确
                </p>
            </div>
        `;
    }
    
    infoDiv.innerHTML = infoContent;
    
    // 同时更新共享参数区域的Delta过滤系统显示
    updateDeltaFilterDisplay(putCount, callCount, optionType, deltaRange);
    
    console.log('自动设置信息显示完成');
}

// 更新Delta过滤系统显示
function updateDeltaFilterDisplay(putCount, callCount, optionType, deltaRange) {
    const autoFilterInfo = document.getElementById('auto-filter-info');
    const filterDetails = document.getElementById('filter-details');
    
    if (autoFilterInfo && filterDetails) {
        // 显示自动过滤信息区域
        autoFilterInfo.style.display = 'block';
        
        // 生成详细信息内容
        let detailsContent = '';
        
        if (putCount > 0 && callCount > 0) {
            detailsContent = `
                <p style="margin: 5px 0; font-weight: 500;">
                    检测到 <span style="color: #e53e3e; font-weight: 600;">${putCount} 个看跌期权</span>, 
                    <span style="color: #38a169; font-weight: 600;">${callCount} 个看涨期权</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    主要类型: <span style="color: #0066cc; font-weight: 600;">${optionType}</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    自动设置Delta范围: <span style="color: #0066cc; font-weight: 600;">${deltaRange}</span>
                </p>
                <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                    这个范围覆盖了看涨和看跌期权，适合卖方策略，风险相对可控
                </p>
            `;
        } else if (putCount > 0) {
            detailsContent = `
                <p style="margin: 5px 0; font-weight: 500;">
                    检测到 <span style="color: #e53e3e; font-weight: 600;">${putCount} 个看跌期权</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    主要类型: <span style="color: #0066cc; font-weight: 600;">${optionType}</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    自动设置Delta范围: <span style="color: #0066cc; font-weight: 600;">${deltaRange}</span>
                </p>
                <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                    这个范围适合看跌期权卖方策略，风险相对可控
                </p>
            `;
        } else if (callCount > 0) {
            detailsContent = `
                <p style="margin: 5px 0; font-weight: 500;">
                    检测到 <span style="color: #38a169; font-weight: 600;">${callCount} 个看涨期权</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    主要类型: <span style="color: #0066cc; font-weight: 600;">${optionType}</span>
                </p>
                <p style="margin: 5px 0; font-weight: 500;">
                    自动设置Delta范围: <span style="color: #0066cc; font-weight: 600;">${deltaRange}</span>
                </p>
                <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                    这个范围适合看涨期权卖方策略，风险相对可控
                </p>
            `;
        }
        
        filterDetails.innerHTML = detailsContent;
        console.log('✅ Delta过滤系统显示已更新');
    }
}

// 计算单个期权的期望价值(EV)
function calculateOptionEV(option, underlyingPrice, daysToExpiry) {
    try {
        // 计算内在价值
        let intrinsicValue = 0;
        if (option.type === 'Call') {
            intrinsicValue = Math.max(0, underlyingPrice - option.strike);
        } else {
            intrinsicValue = Math.max(0, option.strike - underlyingPrice);
        }
        
        // 计算时间价值
        const timeValue = option.timeValue || (option.midPrice - intrinsicValue);
        
        // 计算风险
        const maxLoss = option.midPrice; // 最大损失是权利金
        const maxProfit = intrinsicValue > 0 ? '无限' : option.midPrice; // 实值期权理论收益无限
        
        // 计算概率加权收益
        // 使用Delta作为价格变动概率的近似
        const delta = Math.abs(option.delta);
        const probability = delta; // Delta近似等于到期时实值的概率
        
        // 计算期望价值
        // EV = 概率 × 收益 - (1-概率) × 损失
        let expectedValue;
        if (intrinsicValue > 0) {
            // 实值期权
            expectedValue = probability * (intrinsicValue + timeValue) - (1 - probability) * timeValue;
        } else {
            // 虚值期权
            expectedValue = probability * timeValue - (1 - probability) * timeValue;
        }
        
        // 考虑时间衰减
        const timeDecay = option.theta * (daysToExpiry / 365);
        expectedValue += timeDecay;
        
        return expectedValue;
        
    } catch (error) {
        console.error('计算期权EV时出错:', error);
        return 0;
    }
}

// 显示导入预览
function showImportPreview(options) {
    if (!options || options.length === 0) {
        console.log('没有期权数据可显示');
        return;
    }
    
    console.log('显示导入预览，期权数量:', options.length);
    
    // 创建预览表格
    const previewContainer = document.getElementById('import-preview');
    if (!previewContainer) {
        console.warn('未找到预览容器');
        return;
    }
    
    previewContainer.style.display = 'block';
    
    // 清空现有内容
    previewContainer.innerHTML = '';
    
    // 创建表格
    const table = document.createElement('table');
    table.className = 'preview-table';
    
    // 创建表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['类型', '行权价', 'Delta', '中间价', '买入价', '卖出价', '成交量', '未平仓数'];
    
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // 创建表体
    const tbody = document.createElement('tbody');
    
    // 显示前20行数据
    console.log('showImportPreview - 接收到的options:', options);
    console.log('showImportPreview - options长度:', options.length);
    console.log('showImportPreview - 第一个option示例:', options[0]);
    
    const displayOptions = options.slice(0, 20);
    console.log('showImportPreview - displayOptions长度:', displayOptions.length);
    
    displayOptions.forEach((option, rowIndex) => {
        console.log(`第${rowIndex + 1}行option数据:`, option);
        const row = document.createElement('tr');
        
        const cells = [
            option.type || '--',
            option.strike || '--',
            option.delta ? option.delta.toFixed(4) : '--',
            option.midPrice ? option.midPrice.toFixed(2) : '--',
            option.bid ? option.bid.toFixed(2) : '--',
            option.ask ? option.ask.toFixed(2) : '--',
            option.volumeText || '--',
            option.openInterestText || '--'
        ];
        
        cells.forEach((cellText, index) => {
            const td = document.createElement('td');
            // 检查cellText是否为undefined或null
            if (cellText === undefined || cellText === null) {
                td.textContent = '--';
                console.warn(`第${index}列数据缺失:`, cellText);
            } else {
                td.textContent = cellText;
            }
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    previewContainer.appendChild(table);
    
    // 添加统计信息
    const statsDiv = document.createElement('div');
    statsDiv.className = 'import-stats';
    statsDiv.innerHTML = `
        <h3>导入统计</h3>
        <p>总期权数: ${options.length}</p>
        <p>看涨期权: ${options.filter(opt => opt.type === 'Call').length}个</p>
        <p>看跌期权: ${options.filter(opt => opt.type === 'Put').length}个</p>
        <p>显示前20行数据</p>
    `;
    previewContainer.appendChild(statsDiv);
    
    console.log('预览显示完成');
}

// 计算期权期望价值(EV) - 修复版本
function calculateExpectedValue(option, underlyingPrice, daysToExpiry) {
    // 基本参数
    const strike = option.strike;
    const midPrice = option.midPrice;
    const delta = option.delta;
    const gamma = option.gamma;
    const theta = option.theta;
    const vega = option.vega;
    const impliedVol = option.impliedVolatility || 0.3;
    
    // 计算期权状态
    const isITM = option.type === 'Call' ? 
        (underlyingPrice > strike) : 
        (underlyingPrice < strike);
    
    // 计算内在价值
    let intrinsicValue = 0;
    if (option.type === 'Call') {
        intrinsicValue = Math.max(0, underlyingPrice - strike);
    } else {
        intrinsicValue = Math.max(0, strike - underlyingPrice);
    }
    
    // 计算时间价值
    const timeValue = midPrice - intrinsicValue;
    
    // 年化时间
    const T = daysToExpiry / 252.0;
    
    // 使用改进的行权概率计算：Delta 80% + 盈利概率 20%
    const exerciseProb = calculateExerciseProbability(delta, option.profitProbability);
    const noExerciseProb = 1 - exerciseProb;
    
    // 计算潜在赔付（使用精确版数值积分方法）
    let potentialPayout = 0;
    
    if (option.type === 'Call') {
        if (!isITM) {
            // 虚值看涨期权：使用数值积分计算期望损失
            potentialPayout = calculatePotentialPayoutIntegral(option, underlyingPrice, daysToExpiry);
        } else {
            // 实值看涨期权：内在价值 + 时间价值风险积分
            potentialPayout = intrinsicValue + calculatePotentialPayoutIntegral(option, underlyingPrice, daysToExpiry);
        }
    } else {
        if (!isITM) {
            // 虚值看跌期权：使用数值积分计算期望损失
            potentialPayout = calculatePotentialPayoutIntegral(option, underlyingPrice, daysToExpiry);
        } else {
            // 实值看跌期权：内在价值 + 时间价值风险积分
            potentialPayout = intrinsicValue + calculatePotentialPayoutIntegral(option, underlyingPrice, daysToExpiry);
        }
    }
    
    // 计算EV
    const premiumComponent = midPrice * noExerciseProb;
    const payoutComponent = potentialPayout * exerciseProb;
    const expectedValue = premiumComponent - payoutComponent;
    
    // 风险收益比
    const riskRewardRatio = potentialPayout / midPrice;
    
    return {
        intrinsicValue: intrinsicValue,
        timeValue: timeValue,
        exerciseProbability: exerciseProb,
        noExerciseProbability: noExerciseProb,
        potentialPayout: potentialPayout,
        expectedValue: expectedValue,
        isITM: isITM,
        riskRewardRatio: riskRewardRatio,
        premiumComponent: premiumComponent,
        payoutComponent: payoutComponent,
        impliedVolatility: impliedVol
    };
}

// 新增：改进的行权概率计算函数
function calculateExerciseProbability(delta, profitProbability) {
    // 解析盈利概率（去掉%符号）
    const profitProb = parseFloat(profitProbability) / 100;
    
    // Delta绝对值作为基础概率
    const deltaProb = Math.abs(delta);
    
    // 加权平均：Delta 80%，盈利概率 20%
    const exerciseProb = deltaProb * 0.8 + profitProb * 0.2;
    
    // 确保概率在合理范围内
    return Math.max(0.01, Math.min(0.99, exerciseProb));
}

// 改进的突破概率计算函数 - 基于正态分布
function calculateBreakProbability(price_ratio, volatility_impact) {
    if (volatility_impact <= 0) return 0.01;
    
    // 标准化价格差距
    const z_score = price_ratio / volatility_impact;
    
    // 使用改进的正态分布近似
    let probability;
    
    if (z_score >= 0) {
        // 价格差距大于波动影响，突破概率较低
        probability = 0.5 * Math.exp(-z_score * 1.5);
    } else {
        // 价格差距小于波动影响，突破概率较高
        probability = 0.5 * (1 - Math.exp(z_score * 1.5));
    }
    
    // 确保概率在合理范围内
    return Math.max(0.01, Math.min(0.99, probability));
}

// 批量计算所有期权的EV
function calculateAllOptionsEV(options, underlyingPrice, daysToExpiry) {
    console.log('开始计算期权期望价值...');
    
    const results = [];
    
    for (const option of options) {
        try {
            const ev = calculateExpectedValue(option, underlyingPrice, daysToExpiry);
            
            // 添加调试信息：显示行权概率计算过程
            const deltaProb = Math.abs(option.delta);
            const profitProb = parseFloat(option.profitProbability) / 100;
            const weightedProb = deltaProb * 0.8 + profitProb * 0.2;
            
            console.log(`期权 ${option.type} ${option.strike}:`);
            console.log(`  Delta概率: ${deltaProb.toFixed(4)}`);
            console.log(`  盈利概率: ${profitProb.toFixed(4)}`);
            console.log(`  加权概率: ${weightedProb.toFixed(4)}`);
            console.log(`  最终EV: ${ev.expectedValue.toFixed(4)}`);
            console.log(`  潜在赔付: ${ev.potentialPayout.toFixed(4)}`);
            
            const result = {
                ...option,
                ev: ev
            };
            
            results.push(result);
            
        } catch (error) {
            console.error(`计算期权 ${option.type} ${option.strike} 的EV时出错:`, error);
        }
    }
    
    console.log(`EV计算完成，共计算 ${results.length} 个期权`);
    return results;
}

// 显示EV计算结果
function showEVResults(optionsWithEV) {
    console.log('showEVResults被调用，期权数量:', optionsWithEV.length);
    
    // 验证数据
    if (!optionsWithEV || optionsWithEV.length === 0) {
        console.log('没有期权数据，不显示结果');
        return;
    }
    
    // 查找结果容器
    let resultsContainer = document.getElementById('results-section');
    if (!resultsContainer) {
        console.error('未找到results-section，尝试使用import-preview');
        resultsContainer = document.getElementById('import-preview');
        if (!resultsContainer) {
            console.error('两个容器都未找到');
            return;
        }
    }
    
    // 确保结果区域可见
    resultsContainer.style.display = 'block';
    
    // 清空现有内容
    resultsContainer.innerHTML = '';
    
    // 创建EV结果表格
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover table-sm';
    table.style.cssText = 'font-size: 14px; margin-top: 20px;';
    
    // 创建表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['类型', '行权价', 'Delta', '权利金', '内在价值', '时间价值', '盈利概率', '加权概率', '期望价值(EV)', '风险收益比', '风险分析'];
    
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.style.cssText = 'text-align: center; padding: 12px 8px; background: #f8f9fa; border: 1px solid #dee2e6; font-weight: 600;';
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // 创建表体
    const tbody = document.createElement('tbody');
    
    // 按期望价值排序（从高到低）
    const sortedOptions = [...optionsWithEV].sort((a, b) => b.ev.expectedValue - a.ev.expectedValue);
    
    // 显示前30行数据
    const displayOptions = sortedOptions.slice(0, 30);
    
    displayOptions.forEach(option => {
        const row = document.createElement('tr');
        row.style.cssText = 'border-bottom: 1px solid #dee2e6;';
        
        // 计算加权概率
        const deltaProb = Math.abs(option.delta);
        const profitProb = parseFloat(option.profitProbability) / 100;
        const weightedProb = deltaProb * 0.8 + profitProb * 0.2;
        
        const cells = [
            option.type,
            option.strike,
            option.delta.toFixed(4),
            option.midPrice.toFixed(2),
            option.ev.intrinsicValue.toFixed(4),
            option.ev.timeValue.toFixed(4),
            (profitProb * 100).toFixed(1) + '%',
            (weightedProb * 100).toFixed(1) + '%',
            option.ev.expectedValue.toFixed(4),
            option.ev.riskRewardRatio.toFixed(2)
        ];
        
        cells.forEach((cellText, index) => {
            const td = document.createElement('td');
            td.textContent = cellText;
            td.style.cssText = 'text-align: center; padding: 10px 8px; border: 1px solid #dee2e6;';
            
            // 为不同类型的数据添加特殊样式
            if (index === 0) { // 类型列
                if (option.type === 'Call') {
                    td.innerHTML = `<span class="badge bg-success">${option.type}</span>`;
                } else {
                    td.innerHTML = `<span class="badge bg-danger">${option.type}</span>`;
                }
            } else if (index === 2) { // Delta列
                td.style.color = '#000000';
                td.style.fontWeight = '600';
            } else if (index === 8) { // EV列
                const evValue = parseFloat(cellText);
                td.style.color = evValue > 0 ? '#f59e0b' : '#dc3545';
                td.style.fontWeight = '700';
                if (evValue > 0) {
                    td.innerHTML = `<span class="badge bg-warning" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important; color: #1f2937 !important; border: 1px solid #fbbf24;">$${cellText}</span>`;
                } else {
                    td.innerHTML = `<span class="badge bg-danger">$${cellText}</span>`;
                }
            } else if (index === 3) { // 权利金列
                td.style.color = '#f59e0b';
                td.style.fontWeight = '700';
                td.innerHTML = `<span class="badge bg-warning" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important; color: #1f2937 !important; border: 1px solid #fbbf24;">$${cellText}</span>`;
            } else if (index === 9) { // 风险收益比列
                const ratio = parseFloat(cellText);
                td.style.color = '#000000';
                td.style.fontWeight = '600';
                td.textContent = cellText;
            }
            
            row.appendChild(td);
        });
        
        // 添加风险分析按钮
        const riskTd = document.createElement('td');
        riskTd.style.cssText = 'text-align: center; padding: 10px 8px; border: 1px solid #dee2e6;';
        
        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; flex-direction: column; gap: 5px; align-items: center;';
        
        // 风险分布按钮
        const riskButton = document.createElement('button');
        riskButton.textContent = '查看风险分布';
        riskButton.className = 'btn btn-sm btn-outline-primary';
        riskButton.style.cssText = 'padding: 6px 12px; font-size: 12px; width: 100%;';
        riskButton.onclick = () => toggleRiskDistribution(option, row);
        buttonContainer.appendChild(riskButton);
        
        // EV计算详情按钮
        const evButton = document.createElement('button');
        evButton.textContent = 'EV计算详情';
        evButton.className = 'btn btn-sm btn-outline-success';
        evButton.style.cssText = 'padding: 6px 12px; font-size: 12px; width: 100%;';
        evButton.onclick = () => {
            console.log('EV计算详情按钮被点击，期权:', option);
            showEVCalculationDetails(option);
        };
        buttonContainer.appendChild(evButton);
        
        riskTd.appendChild(buttonContainer);
        row.appendChild(riskTd);
        tbody.appendChild(row);
        
        // 创建风险分布行（初始隐藏）
        const riskRow = document.createElement('tr');
        riskRow.className = 'risk-distribution-row';
        riskRow.style.display = 'none';
        
        const riskCell = document.createElement('td');
        riskCell.colSpan = headers.length;
        riskCell.className = 'risk-distribution-cell';
        
        // 创建图表容器
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.style.height = '300px';
        chartContainer.style.position = 'relative';
        
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${option.type}-${option.strike}`;
        chartContainer.appendChild(canvas);
        
        riskCell.appendChild(chartContainer);
        riskRow.appendChild(riskCell);
        tbody.appendChild(riskRow);
    });
    
    table.appendChild(tbody);
    resultsContainer.appendChild(table);
    
    // 添加简洁的EV统计信息
    const statsDiv = document.createElement('div');
    statsDiv.className = 'import-stats';
    
    const callOptions = optionsWithEV.filter(opt => opt.type === 'Call');
    const putOptions = optionsWithEV.filter(opt => opt.type === 'Put');
    
    const avgCallEV = callOptions.length > 0 ? 
        callOptions.reduce((sum, opt) => sum + opt.ev.expectedValue, 0) / callOptions.length : 0;
    const avgPutEV = putOptions.length > 0 ? 
        putOptions.reduce((sum, opt) => sum + opt.ev.expectedValue, 0) / putOptions.length : 0;
    
    statsDiv.innerHTML = `
        <h3>期望价值(EV)分析结果</h3>
        <p>总期权数: ${optionsWithEV.length} | 看涨期权: ${callOptions.length}个 | 看跌期权: ${putOptions.length}个</p>
        <p>最高EV期权: ${sortedOptions[0]?.type} ${sortedOptions[0]?.strike} (EV: ${sortedOptions[0]?.ev.expectedValue.toFixed(4)})</p>
        <p><strong>行权概率计算方式:</strong> Delta 80% + 盈利概率 20%</p>
    `;
    resultsContainer.appendChild(statsDiv);
    
    console.log('EV结果显示完成');
}

// 切换风险分布图显示
function toggleRiskDistribution(option, row) {
    const riskRow = row.nextElementSibling;
    if (!riskRow || !riskRow.classList.contains('risk-distribution-row')) {
        console.error('未找到风险分布行');
        return;
    }
    
    if (riskRow.style.display === 'none') {
        // 显示风险分布图
        riskRow.style.display = 'table-row';
        createRiskDistributionChart(option);
        
        // 更新按钮文本
        const button = row.querySelector('.risk-analysis-btn');
        if (button) button.textContent = '隐藏风险分布';
    } else {
        // 隐藏风险分布图
        riskRow.style.display = 'none';
        
        // 更新按钮文本
        const button = row.querySelector('.risk-analysis-btn');
        if (button) button.textContent = '查看风险分布';
    }
}

// 创建风险分布图
function createRiskDistributionChart(option) {
    const canvasId = `chart-${option.type}-${option.strike}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error('未找到画布元素:', canvasId);
        return;
    }
    
    // 由于删除了输入框，使用全局变量或默认值
    // 这些值应该从CSV导入或API获取时设置
    const underlyingPrice = window.currentUnderlyingPrice || 340;
    const daysToExpiry = window.currentDaysToExpiry || 6;
    
    const strike = option.strike;
    const premium = option.midPrice;
    
    // 修复隐含波动率处理 - 如果已经是小数就不再除100
    let impliedVol = option.impliedVolatility;
    if (impliedVol > 1) {
        impliedVol = impliedVol / 100; // 只有当值大于1时才除以100
    }
    
    console.log(`图表参数: 标的价格=${underlyingPrice}, 行权价=${strike}, 隐含波动率=${impliedVol}, 天数=${daysToExpiry}`);
    
    // 计算分布参数
    const T = daysToExpiry / 252; // 年化时间
    const std = underlyingPrice * impliedVol * Math.sqrt(T);
    
    // 生成分布数据点
    const data = generateNormalDistributionData(underlyingPrice, std, strike);
    
    // 创建Chart.js图表
    const ctx = canvas.getContext('2d');
    
    // 销毁现有图表（如果存在）
    if (window.charts && window.charts[canvasId]) {
        window.charts[canvasId].destroy();
    }
    
    // 初始化charts对象
    if (!window.charts) window.charts = {};
    
    window.charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.x.toFixed(1)),
            datasets: [{
                label: '价格概率分布',
                data: data.map(d => ({ x: d.x.toFixed(1), y: d.y })),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                type: 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${option.type} ${strike} 风险分布分析`
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `价格: $${context.parsed.x}, 概率密度: ${context.parsed.y.toFixed(4)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: '标的价格 ($)'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(1);
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '概率密度'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            elements: {
                point: {
                    radius: 0
                }
            }
        }
    });
    
    // 添加关键价格线
    addKeyPriceLines(window.charts[canvasId], underlyingPrice, strike, std);
    
    // 先清理已存在的"显示计算详情"按钮，避免重复
    const existingButton = canvas.parentElement.querySelector('.btn-outline-info');
    if (existingButton) {
        existingButton.remove();
    }
    
    // 添加一个"显示计算详情"的按钮
    const showDetailsButton = document.createElement('button');
    showDetailsButton.textContent = '显示计算详情';
    showDetailsButton.className = 'btn btn-sm btn-outline-info';
    showDetailsButton.style.cssText = 'margin-top: 10px; width: 100%;';
    showDetailsButton.onclick = () => {
        // 如果按钮显示"显示计算详情"，则显示详情
        if (showDetailsButton.textContent === '显示计算详情') {
            // 创建计算详情行
            const detailsRow = document.createElement('tr');
            detailsRow.className = 'calculation-details-row';
            detailsRow.style.display = 'table-row';
            detailsRow.id = `details-row-${Date.now()}`; // 添加唯一ID
            
            const detailsCell = document.createElement('td');
            detailsCell.colSpan = 11; // 跨越所有列
            detailsCell.className = 'calculation-details-cell';
            detailsCell.style.cssText = 'padding: 20px; background: #f8f9fa; border: 1px solid #dee2e6;';
            
            // 添加风险分析信息到详情行
            addRiskAnalysisInfo(detailsCell, option, underlyingPrice, strike, std, premium);
            
            detailsRow.appendChild(detailsCell);
            
            // 将详情行插入到图表行之后
            const chartRow = canvas.closest('tr');
            chartRow.parentNode.insertBefore(detailsRow, chartRow.nextSibling);
            
            showDetailsButton.textContent = '隐藏计算详情';
            
            // 不再隐藏表格行中的金色徽章，保持始终可见
        } else {
            // 如果按钮显示"隐藏计算详情"，则隐藏详情行
            // 使用更可靠的查找方式
            const chartRow = canvas.closest('tr');
            console.log('🔍 查找详情行:', chartRow);
            
            if (chartRow) {
                // 查找下一个兄弟元素
                let nextSibling = chartRow.nextElementSibling;
                let found = false;
                
                while (nextSibling) {
                    console.log('检查兄弟元素:', nextSibling, '类名:', nextSibling.className);
                    if (nextSibling.classList && nextSibling.classList.contains('calculation-details-row')) {
                        console.log('✅ 找到详情行，准备删除');
                        nextSibling.remove();
                        found = true;
                        break;
                    }
                    nextSibling = nextSibling.nextElementSibling;
                }
                
                if (!found) {
                    console.log('⚠️ 未找到详情行，尝试其他方法');
                    // 备用方法：直接查找所有详情行
                    const allDetailsRows = document.querySelectorAll('.calculation-details-row');
                    console.log('找到的详情行数量:', allDetailsRows.length);
                    allDetailsRows.forEach(row => {
                        console.log('删除详情行:', row);
                        row.remove();
                    });
                }
                
                // 额外检查：如果还是没有找到，尝试查找包含风险分析信息的元素
                if (document.querySelector('.risk-info')) {
                    console.log('🔍 找到风险分析信息，尝试隐藏');
                    const riskInfoElements = document.querySelectorAll('.risk-info');
                    riskInfoElements.forEach(element => {
                        element.style.display = 'none';
                    });
                }
            }
            
            // 最后的安全措施：隐藏所有相关的计算详情
            const allCalculationDetails = document.querySelectorAll('.calculation-details-cell, .risk-info');
            if (allCalculationDetails.length > 0) {
                console.log('🔒 安全措施：隐藏所有计算详情元素');
                allCalculationDetails.forEach(element => {
                    element.style.display = 'none';
                });
            }
            showDetailsButton.textContent = '显示计算详情';
            
            // 不再需要重新显示金色徽章，因为始终可见
        }
    };
    
    canvas.parentElement.appendChild(showDetailsButton);
}

// 生成正态分布数据
function generateNormalDistributionData(mean, std, strike) {
    const data = [];
    
    // 确保包含行权价在范围内
    const minPrice = Math.min(mean - 3 * std, strike - std);
    const maxPrice = Math.max(mean + 3 * std, strike + std);
    
    // 使用更小的步长以获得更平滑的曲线
    const step = (maxPrice - minPrice) / 200;
    
    console.log(`生成分布数据: 范围=${minPrice.toFixed(1)}到${maxPrice.toFixed(1)}, 步长=${step.toFixed(3)}`);
    
    for (let price = minPrice; price <= maxPrice; price += step) {
        const y = normalPDF(price, mean, std);
        data.push({ x: price, y: y });
    }
    
    console.log(`生成了${data.length}个数据点`);
    return data;
}

// 正态分布概率密度函数
function normalPDF(x, mean, std) {
    const exponent = -0.5 * Math.pow((x - mean) / std, 2);
    return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

// 添加关键价格线
function addKeyPriceLines(chart, underlyingPrice, strike, std) {
    console.log(`添加垂直线: 当前价格=${underlyingPrice}, 行权价=${strike}`);
    
    // 清除之前的垂直线数据集（保留第一个数据集，即正态分布曲线）
    while (chart.data.datasets.length > 1) {
        chart.data.datasets.pop();
    }
    
    // 清除之前的图例说明
    const legendContainer = chart.canvas.parentElement;
    if (legendContainer) {
        const existingLegend = legendContainer.querySelector('.price-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
    }
    
    // 获取Y轴的最大值
    const maxY = Math.max(...chart.data.datasets[0].data);
    
    // 创建垂直线数据 - 使用简单的线图方式
    const currentPriceData = [];
    const strikePriceData = [];
    
    // 为垂直线生成数据点 - 确保X轴值在图表范围内
    const minX = Math.min(...chart.data.labels.map(l => parseFloat(l)));
    const maxX = Math.max(...chart.data.labels.map(l => parseFloat(l)));
    
    // 生成20个点来画垂直线
    for (let i = 0; i <= 20; i++) {
        const yValue = (maxY * i) / 20;
        currentPriceData.push({ x: underlyingPrice, y: yValue });
        strikePriceData.push({ x: strike, y: yValue });
    }
    
    console.log(`垂直线数据: 当前价格=${currentPriceData.length}个点, 行权价=${strikePriceData.length}个点`);
    
    // 添加当前价格垂直线
    chart.data.datasets.push({
        label: '当前价格',
        data: currentPriceData,
        borderColor: 'rgb(0, 128, 0)',
        backgroundColor: 'rgb(0, 128, 0)',
        borderWidth: 6,
        pointRadius: 0,
        showLine: true,
        fill: false,
        tension: 0,
        type: 'scatter'
    });
    
    // 添加行权价垂直线  
    chart.data.datasets.push({
        label: '行权价',
        data: strikePriceData,
        borderColor: 'rgb(255, 0, 0)',
        backgroundColor: 'rgb(255, 0, 0)',
        borderWidth: 6,
        pointRadius: 0,
        showLine: true,
        fill: false,
        tension: 0,
        type: 'scatter'
    });
    
    // 更新图表
    chart.update();
    
    // 添加图例说明（使用唯一类名）
    if (legendContainer) {
        const legendDiv = document.createElement('div');
        legendDiv.className = 'price-legend';
        legendDiv.style.cssText = `
            margin-top: 10px;
            text-align: center;
            font-size: 12px;
            color: #666;
        `;
        legendDiv.innerHTML = `
            <span style="color: rgb(0, 128, 0); font-weight: bold;">●</span> 当前价格 ($${underlyingPrice.toFixed(2)}) | 
            <span style="color: rgb(255, 0, 0); font-weight: bold;">●</span> 行权价 ($${strike.toFixed(2)})
        `;
        legendContainer.appendChild(legendDiv);
    }
    
    console.log('垂直线添加完成');
}

// 添加风险分析信息
function addRiskAnalysisInfo(container, option, underlyingPrice, strike, std, premium) {
    // 获取到期天数
    // 由于删除了输入框，使用全局变量或默认值
    const daysToExpiry = window.currentDaysToExpiry || 6;
    // 移除现有的风险分析信息
    const existingInfo = container.querySelector('.risk-info');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    // 创建风险分析信息面板
    const riskInfo = document.createElement('div');
    riskInfo.className = 'risk-info';
    riskInfo.style.cssText = `
        margin-top: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #007bff;
    `;
    
    // 计算关键概率区间
    const oneSigmaProb = 68.27;
    const twoSigmaProb = 95.45;
    const threeSigmaProb = 99.73;
    
    const oneSigmaRange = [underlyingPrice - std, underlyingPrice + std];
    const twoSigmaRange = [underlyingPrice - 2*std, underlyingPrice + 2*std];
    const threeSigmaRange = [underlyingPrice - 3*std, underlyingPrice + 3*std];
    
    // 计算突破概率
    const breakProbability = calculateBreakProbabilityForChart(underlyingPrice, strike, std);
    
    riskInfo.innerHTML = `
        <h4>风险分析详情</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
                <h5>价格分布区间</h5>
                <p><strong>68%概率:</strong> $${oneSigmaRange[0].toFixed(2)} - $${oneSigmaRange[1].toFixed(2)}</p>
                <p><strong>95%概率:</strong> $${twoSigmaRange[0].toFixed(2)} - $${twoSigmaRange[1].toFixed(2)}</p>
                <p><strong>99.7%概率:</strong> $${threeSigmaRange[0].toFixed(2)} - $${threeSigmaRange[1].toFixed(2)}</p>
            </div>
            <div>
                <h5>期权风险指标</h5>
                <p><strong>标准差:</strong> $${std.toFixed(2)}</p>
                <p><strong>权利金:</strong> $${premium.toFixed(2)}</p>
            </div>
        </div>
                <div style="margin-top: 15px;">
            <h5>计算过程详解</h5>
            <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h6>📊 标准差计算</h6>
                <p><strong>公式:</strong> 标准差 = 标的价格 × 隐含波动率 × √(到期天数/252)</p>
                <p><strong>计算:</strong> $${underlyingPrice.toFixed(2)} × ${(option.impliedVolatility > 1 ? option.impliedVolatility/100 : option.impliedVolatility).toFixed(4)} × √(${daysToExpiry}/252)</p>
                <p><strong>结果:</strong> $${underlyingPrice.toFixed(2)} × ${(option.impliedVolatility > 1 ? option.impliedVolatility/100 : option.impliedVolatility).toFixed(4)} × ${Math.sqrt(daysToExpiry/252).toFixed(4)} = $${std.toFixed(2)}</p>
            </div>
            

            <div style="background: #f0fff0; padding: 10px; border-radius: 5px; margin: 10px 0;">
                <h6 style="color: #28a745;">数值积分（精确版）⭐</h6>
                ${(() => {
                    const integralResult = calculatePotentialPayoutIntegral(option, underlyingPrice, daysToExpiry);
                    const sigma = underlyingPrice * (option.impliedVolatility > 1 ? option.impliedVolatility/100 : option.impliedVolatility) * Math.sqrt(daysToExpiry/252);
                    
                    // 计算几个关键价格点的损失示例
                    let calculationExamples = '';
                    const examplePrices = [
                        underlyingPrice - 2*sigma,
                        underlyingPrice - sigma,
                        underlyingPrice,
                        underlyingPrice + sigma,
                        underlyingPrice + 2*sigma
                    ];
                    
                    calculationExamples = examplePrices.map(price => {
                        let loss = 0;
                        let explanation = '';
                        
                        if (option.type === 'Call') {
                            if (price > strike) {
                                loss = (price - strike) - premium;
                                explanation = `(${price.toFixed(2)} - ${strike.toFixed(2)}) - ${premium.toFixed(2)} = ${loss.toFixed(4)}`;
                            } else {
                                explanation = `价格 ${price.toFixed(2)} < 行权价 ${strike.toFixed(2)}，无损失`;
                            }
                        } else {
                            if (price < strike) {
                                loss = (strike - price) - premium;
                                explanation = `(${strike.toFixed(2)} - ${price.toFixed(2)}) - ${premium.toFixed(2)} = ${loss.toFixed(4)}`;
                            } else {
                                explanation = `价格 ${price.toFixed(2)} > 行权价 ${strike.toFixed(2)}，无损失`;
                            }
                        }
                        
                        return `<p>• 价格 $${price.toFixed(2)}: ${explanation}</p>`;
                    }).join('');
                    
                    return `
                        <p><strong>结果:</strong> $${integralResult.toFixed(4)}</p>
                        <p><strong>积分设置:</strong></p>
                        <p>• 步数: 1000步</p>
                        <p>• 价格范围: ±3σ = $${(underlyingPrice - 3*sigma).toFixed(2)} 到 $${(underlyingPrice + 3*sigma).toFixed(2)}</p>
                        <p>• 步长: ${(6*sigma/1000).toFixed(4)}</p>
                        <p><strong>损失计算示例:</strong></p>
                        ${calculationExamples}
                        <p><strong>积分公式:</strong> ∫(损失 × 概率密度) × 步长</p>
                        <p><strong>计算过程:</strong> 对每个价格点计算损失和概率，累加后乘以步长</p>
                    `;
                })()}
                <p><strong>原理:</strong> 使用1000步数值积分，覆盖6个标准差范围，提供最精确的潜在赔付计算</p>
            </div>
            
            <div style="background: #e6f3ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
                <h6 style="color: #0066cc;">计算参数</h6>
                <p><strong>标的价格:</strong> $${underlyingPrice.toFixed(2)}</p>
                <p><strong>行权价:</strong> $${strike.toFixed(2)}</p>
                <p><strong>隐含波动率:</strong> ${(option.impliedVolatility > 1 ? option.impliedVolatility/100 : option.impliedVolatility).toFixed(4)}</p>
                <p><strong>到期时间:</strong> ${(daysToExpiry/252).toFixed(4)}年</p>
                <p><strong>标准差:</strong> $${(underlyingPrice * (option.impliedVolatility > 1 ? option.impliedVolatility/100 : option.impliedVolatility) * Math.sqrt(daysToExpiry/252)).toFixed(2)}</p>
            </div>
        </div>
        
        <div style="margin-top: 15px;">
            <h5>风险说明</h5>
            <p>图表显示了标的价格的正态分布，绿色虚线为当前价格，红色虚线为行权价。</p>
        </div>
    `;
    
    container.appendChild(riskInfo);
}

// 显示EV计算详情
function showEVCalculationDetails(option) {
    console.log('显示EV计算详情，期权:', option);
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    // 创建内容框
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
    `;
    
    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    `;
    closeBtn.onclick = () => modal.remove();
    
    // 获取参数
    // 由于删除了输入框，使用全局变量或默认值
    const underlyingPrice = window.currentUnderlyingPrice || 340;
    const daysToExpiry = window.currentDaysToExpiry || 6;
    
    // 计算过程
    const deltaProb = Math.abs(option.delta);
    const profitProb = parseFloat(option.profitProbability) / 100;
    const weightedProb = deltaProb * 0.8 + profitProb * 0.2;
    const noExerciseProb = 1 - weightedProb;
    
    // 计算潜在赔付
    const T = daysToExpiry / 252.0;
    const impliedVol = option.impliedVolatility > 1 ? option.impliedVolatility / 100 : option.impliedVolatility;
    const std = underlyingPrice * impliedVol * Math.sqrt(T);
    
    let potentialPayout = 0;
    if (option.type === 'Call') {
        if (underlyingPrice < option.strike) {
            // 虚值看涨期权
            const deltaRisk = Math.abs(option.delta) * underlyingPrice * 0.1;
            const gammaRisk = (option.gamma || 0) * underlyingPrice * underlyingPrice * 0.01;
            const volatilityRisk = underlyingPrice * impliedVol * Math.sqrt(T) * Math.abs(option.delta);
            potentialPayout = Math.max(0, deltaRisk + gammaRisk + volatilityRisk * 0.043); // 使用4.3%突破概率
        } else {
            // 实值看涨期权
            const intrinsicValue = Math.max(0, underlyingPrice - option.strike);
            const deltaRisk = Math.abs(option.delta) * underlyingPrice * 0.15;
            const gammaRisk = (option.gamma || 0) * underlyingPrice * underlyingPrice * 0.02;
            const volatilityRisk = underlyingPrice * impliedVol * Math.sqrt(T) * Math.abs(option.delta) * 0.5;
            potentialPayout = intrinsicValue + deltaRisk + gammaRisk + volatilityRisk;
        }
    }
    
    const premiumComponent = option.midPrice * noExerciseProb;
    const payoutComponent = potentialPayout * weightedProb;
    const expectedValue = premiumComponent - payoutComponent;
    
    content.innerHTML = `
        <h2 style="color: #333; margin-bottom: 20px;">${option.type} ${option.strike} EV计算详情</h2>
        
        <div style="margin-bottom: 20px;">
            <h3 style="color: #007bff;">📊 基础参数</h3>
            <p><strong>标的价格:</strong> $${underlyingPrice.toFixed(2)}</p>
            <p><strong>行权价:</strong> $${option.strike.toFixed(2)}</p>
            <p><strong>权利金:</strong> $${option.midPrice.toFixed(2)}</p>
            <p><strong>到期天数:</strong> ${daysToExpiry}天</p>
            <p><strong>隐含波动率:</strong> ${(impliedVol * 100).toFixed(2)}%</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h3 style="color: #28a745;">🎯 行权概率计算</h3>
            <p><strong>Delta概率:</strong> |${option.delta.toFixed(4)}| = ${deltaProb.toFixed(4)}</p>
            <p><strong>盈利概率:</strong> ${option.profitProbability} = ${profitProb.toFixed(4)}</p>
            <p><strong>加权概率:</strong> ${deltaProb.toFixed(4)} × 0.8 + ${profitProb.toFixed(4)} × 0.2 = ${weightedProb.toFixed(4)}</p>
            <p><strong>不行权概率:</strong> 1 - ${weightedProb.toFixed(4)} = ${noExerciseProb.toFixed(4)}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h3 style="color: #dc3545;">⚠️ 潜在赔付计算</h3>
            <p><strong>年化时间:</strong> ${daysToExpiry}/252 = ${T.toFixed(4)}年</p>
            <p><strong>标准差:</strong> $${underlyingPrice.toFixed(2)} × ${impliedVol.toFixed(4)} × √${T.toFixed(4)} = $${std.toFixed(2)}</p>
            <p><strong>期权状态:</strong> ${underlyingPrice < option.strike ? '虚值' : '实值'}</p>
            
            <div style="background: #fff5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h6>⚠️ 潜在赔付计算（数值积分法）</h6>
                
                <div style="background: #f0fff0; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <h6 style="color: #28a745;">数值积分（精确版）⭐</h6>
                    ${(() => {
                        const integralResult = calculatePotentialPayoutIntegral(option, underlyingPrice, daysToExpiry);
                        const sigma = underlyingPrice * (option.impliedVolatility > 1 ? option.impliedVolatility/100 : option.impliedVolatility) * Math.sqrt(daysToExpiry/252);
                        
                        return `
                            <p><strong>结果:</strong> $${integralResult.toFixed(4)}</p>
                            <p><strong>积分设置:</strong></p>
                            <p>• 步数: 1000步</p>
                            <p>• 价格范围: ±3σ = $${(underlyingPrice - 3*sigma).toFixed(2)} 到 $${(underlyingPrice + 3*sigma).toFixed(2)}</p>
                            <p>• 步长: ${(6*sigma/1000).toFixed(4)}</p>
                            <p><strong>积分公式:</strong> ∫(损失 × 概率密度) × 步长</p>
                            <p><strong>计算过程:</strong> 对每个价格点计算损失和概率，累加后乘以步长</p>
                        `;
                    })()}
                    <p><strong>原理:</strong> 使用1000步数值积分，覆盖6个标准差范围，提供最精确的潜在赔付计算</p>
                </div>
                
                <div style="background: #e6f3ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <h6 style="color: #0066cc;">计算参数</h6>
                    <p><strong>标的价格:</strong> $${underlyingPrice.toFixed(2)}</p>
                    <p><strong>行权价:</strong> $${option.strike.toFixed(2)}</p>
                    <p><strong>隐含波动率:</strong> ${(option.impliedVolatility > 1 ? option.impliedVolatility/100 : option.impliedVolatility).toFixed(4)}</p>
                    <p><strong>到期时间:</strong> ${(daysToExpiry/252).toFixed(4)}年</p>
                    <p><strong>标准差:</strong> $${(underlyingPrice * (option.impliedVolatility > 1 ? option.impliedVolatility/100 : option.impliedVolatility) * Math.sqrt(daysToExpiry/252)).toFixed(2)}</p>
                </div>
            </div>
            
            <div style="background: #f0fff0; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h6>💰 EV计算过程</h6>
                <p><strong>行权概率:</strong> Delta 80% + 盈利概率 20% = ${Math.abs(option.delta).toFixed(4)} × 0.8 + ${(parseFloat(option.profitProbability)/100).toFixed(4)} × 0.2 = ${(Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2).toFixed(4)}</p>
                <p><strong>不行权概率:</strong> 1 - ${(Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2).toFixed(4)} = ${(1 - (Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2)).toFixed(4)}</p>
                <p><strong>权利金收益:</strong> $${option.midPrice.toFixed(2)} × ${(1 - (Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2)).toFixed(4)} = $${(option.midPrice * (1 - (Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2))).toFixed(4)}</p>
                <p><strong>潜在赔付:</strong> $${(option.ev ? option.ev.potentialPayout : 0).toFixed(2)} × ${(Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2).toFixed(4)} = $${(option.ev ? option.ev.potentialPayout * (Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2) : 0).toFixed(4)}</p>
                <p><strong>最终EV:</strong> $${(option.midPrice * (1 - (Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2))).toFixed(4)} - $${(option.ev ? option.ev.potentialPayout * (Math.abs(option.delta) * 0.8 + parseFloat(option.profitProbability)/100 * 0.2) : 0).toFixed(4)} = $${(option.ev ? option.ev.expectedValue : 0).toFixed(4)}</p>
            </div>
    `;
    
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    console.log('EV计算详情模态框创建完成');
}

// 计算突破概率（用于图表显示）
function calculateBreakProbabilityForChart(underlyingPrice, strike, std) {
    console.log(`突破概率计算: 标的=${underlyingPrice}, 行权价=${strike}, 标准差=${std}`);
    
    if (std <= 0) {
        console.warn('标准差为0或负数，返回默认概率');
        return 0.01;
    }
    
    if (strike > underlyingPrice) {
        // 看涨期权，计算股价上涨到行权价的概率
        const z = (strike - underlyingPrice) / std;
        const prob = 1 - normalCDF(z);
        console.log(`看涨期权突破概率: z=${z.toFixed(4)}, 概率=${(prob*100).toFixed(2)}%`);
        return Math.max(0.001, Math.min(0.999, prob));
    } else {
        // 看跌期权，计算股价下跌到行权价的概率
        const z = (underlyingPrice - strike) / std;
        const prob = 1 - normalCDF(z);
        console.log(`看跌期权突破概率: z=${z.toFixed(4)}, 概率=${(prob*100).toFixed(2)}%`);
        return Math.max(0.001, Math.min(0.999, prob));
    }
}

// 标准正态分布累积分布函数（近似）
function normalCDF(z) {
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

// 误差函数（近似）
function erf(x) {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
}

// 使用积分方法计算期望损失
function calculateExpectedLossIntegral(underlyingPrice, strike, std, optionType) {
    // 使用数值积分计算期望损失
    const numPoints = 1000;
    let totalLoss = 0;
    
    if (optionType === 'call') {
        // 看涨期权：计算价格超过行权价时的期望损失
        const startPrice = strike;
        const endPrice = underlyingPrice + 4 * std; // 4个标准差范围
        const step = (endPrice - startPrice) / numPoints;
        
        for (let i = 0; i < numPoints; i++) {
            const price = startPrice + i * step;
            const loss = price - strike; // 看涨期权的损失
            const probability = normalPDF(price, underlyingPrice, std);
            totalLoss += loss * probability * step;
        }
    } else {
        // 看跌期权：计算价格低于行权价时的期望损失
        const startPrice = Math.max(0, underlyingPrice - 4 * std); // 4个标准差范围
        const endPrice = strike;
        const step = (endPrice - startPrice) / numPoints;
        
        for (let i = 0; i < numPoints; i++) {
            const price = startPrice + i * step;
            const loss = strike - price; // 看跌期权的损失
            const probability = normalPDF(price, underlyingPrice, std);
            totalLoss += loss * probability * step;
        }
    }
    
    return totalLoss;
}

// 计算看涨期权的期望损失积分
function calculateCallExpectedLoss(underlyingPrice, strike, std) {
    // 使用解析解：E[max(S-K, 0)] = S*N(d1) - K*N(d2)
    // 其中 d1 = (ln(S/K) + (r+σ²/2)T) / (σ√T), d2 = d1 - σ√T
    // 简化版本：使用正态分布的期望值公式
    
    const d1 = (Math.log(underlyingPrice / strike) + 0.5 * std * std / (underlyingPrice * underlyingPrice)) / (std / underlyingPrice);
    const d2 = d1 - std / underlyingPrice;
    
    // 使用正态分布CDF
    const N_d1 = normalCDF(d1);
    const N_d2 = normalCDF(d2);
    
    return underlyingPrice * N_d1 - strike * N_d2;
}

// 计算看跌期权的期望损失积分
function calculatePutExpectedLoss(underlyingPrice, strike, std) {
    // 使用解析解：E[max(K-S, 0)] = K*N(-d2) - S*N(-d1)
    
    const d1 = (Math.log(underlyingPrice / strike) + 0.5 * std * std / (underlyingPrice * underlyingPrice)) / (std / underlyingPrice);
    const d2 = d1 - std / underlyingPrice;
    
    // 使用正态分布CDF
    const N_neg_d1 = normalCDF(-d1);
    const N_neg_d2 = normalCDF(-d2);
    
    return strike * N_neg_d2 - underlyingPrice * N_neg_d1;
}

// 使用数值积分（精确版）计算潜在赔付
function calculatePotentialPayoutIntegral(option, underlyingPrice, daysToExpiry) {
    const strike = option.strike;
    const premium = option.midPrice;
    const impliedVol = option.impliedVolatility > 1 ? option.impliedVolatility / 100 : option.impliedVolatility;
    const T = daysToExpiry / 252;
    
    // 计算标准差
    const sigma = underlyingPrice * impliedVol * Math.sqrt(T);
    
    // 数值积分设置
    const steps = 1000;
    const priceRange = 6 * sigma; // 覆盖6个标准差
    let totalLoss = 0;
    
    // 数值积分循环
    for (let i = 0; i < steps; i++) {
        const price = underlyingPrice - priceRange/2 + (priceRange * i / steps);
        const probability = normalPDF(price, underlyingPrice, sigma);
        
        if (option.type === 'Call') {
            if (price > strike) {
                // 看涨期权：价格超过行权价时产生损失
                // 损失 = (价格 - 行权价) - 权利金
                const loss = (price - strike) - premium;
                if (loss > 0) {
                    totalLoss += loss * probability;
                }
            }
        } else {
            if (price < strike) {
                // 看跌期权：价格低于行权价时产生损失
                // 损失 = (行权价 - 价格) - 权利金
                const loss = (strike - price) - premium;
                if (loss > 0) {
                    totalLoss += loss * probability;
                }
            }
        }
    }
    
    // 乘以步长得到积分结果
    return totalLoss * (priceRange / steps);
}

// 自动更新信息显示函数
function updateInputFields(underlyingPrice, daysToExpiry) {
    const autoInfo = document.getElementById('auto-info');
    const autoPrice = document.getElementById('auto-price');
    const autoDays = document.getElementById('auto-days');
    
    if (autoInfo && autoPrice && autoDays) {
        // 显示自动信息区域
        autoInfo.style.display = 'block';
        
        // 更新价格信息
        if (underlyingPrice) {
            autoPrice.textContent = `$${underlyingPrice.toFixed(2)}`;
            console.log('✅ 自动更新标的价格显示:', underlyingPrice);
        }
        
        // 更新天数信息
        if (daysToExpiry) {
            autoDays.textContent = `${daysToExpiry}天`;
            console.log('✅ 自动更新到期天数显示:', daysToExpiry);
        }
        
        // 添加检测方法说明
        const detectionInfo = document.getElementById('detection-info');
        if (!detectionInfo) {
            const infoDiv = document.createElement('div');
            infoDiv.id = 'detection-info';
            infoDiv.style.cssText = `
                margin-top: 10px;
                padding: 8px;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 6px;
                font-size: 0.8rem;
                color: #666;
                text-align: center;
            `;
            infoDiv.innerHTML = `
                <i class="fas fa-info-circle"></i> 
                系统自动检测：标的价格基于Delta=0.5上下期权的加权平均，到期天数从CSV元数据提取
            `;
            autoInfo.appendChild(infoDiv);
        }
        

        
        // 添加成功动画效果
        autoInfo.style.animation = 'fadeInUp 0.5s ease-out';
    }
}

// API相关函数
async function fetchDataFromAPI() {
    const stockCode = document.getElementById('stock-code').value;
    const targetDate = document.getElementById('target-date').value;
    const apiStatus = document.getElementById('api-status');
    const statusText = document.getElementById('status-text');
    
    if (!stockCode || !targetDate) {
        showError('请填写股票代码和到期日期');
        return;
    }
    
    // 显示状态
    apiStatus.style.display = 'block';
    statusText.textContent = '正在连接API...';
    apiStatus.style.background = '#fff3cd';
    apiStatus.style.color = '#856404';
    apiStatus.style.border = '1px solid #ffeaa7';
    
    try {
        // 调用API生成CSV
        const response = await fetch('http://10.0.4.58:8000/api/generate-csv', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stock_code: stockCode,
                target_date: targetDate
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // 更新状态
            statusText.textContent = `✅ 数据获取成功！共${result.data.rows}行数据`;
            apiStatus.style.background = '#d4edda';
            apiStatus.style.color = '#155724';
            apiStatus.style.border = '1px solid #c3e6cb';
            
            // 处理CSV数据
            const csvText = result.data.csv_content;
            console.log('API返回的CSV数据长度:', csvText.length);
            console.log('API返回的完整数据结构:', result);
            
            // 保存原始CSV文本到全局变量
            window.rawCSVText = csvText;
            
            // 解析CSV数据
            const csvData = parseCSV(csvText);
            console.log('CSV解析完成，数据行数:', csvData.length);
            console.log('CSV第一行数据示例:', csvData[0]);
            
            // 添加更详细的CSV结构分析
            if (csvData.length > 0) {
                console.log('=== CSV结构详细分析 ===');
                console.log('CSV数据类型:', typeof csvData[0]);
                console.log('列名数量:', Object.keys(csvData[0]).length);
                console.log('所有列名:', Object.keys(csvData[0]));
                
                // 检查前几行数据
                for (let i = 0; i < Math.min(5, csvData.length); i++) {
                    console.log(`第${i}行数据类型:`, typeof csvData[i]);
                    console.log(`第${i}行数据:`, csvData[i]);
                    
                    // 如果是对象，显示其结构
                    if (typeof csvData[i] === 'object' && csvData[i] !== null) {
                        console.log(`第${i}行对象键:`, Object.keys(csvData[i]));
                        console.log(`第${i}行对象值:`, Object.values(csvData[i]));
                    }
                }
            }
            
            // 改进的自动检测逻辑
            let underlyingPrice = null;
            let daysToExpiry = null;
            
            // 处理数据
            const processedData = processCSVData(csvData, 340.00, 4); // 临时使用默认值
            importedOptions = processedData;
            
            // 从CSV数据中提取标的价格和到期天数
            if (csvData.length > 1) {
                const secondLine = csvData[1];
                console.log('CSV第2行内容:', secondLine);
                
                // 检查secondLine的类型和结构
                if (typeof secondLine === 'object' && secondLine !== null) {
                    // CSV解析后的对象，查找包含到期信息的字段
                    const allValues = Object.values(secondLine).join(' ');
                    console.log('CSV第2行所有值:', allValues);
                    
                    // 改进的到期天数提取 - 支持多种格式
                    const daysPatterns = [
                        /到期日：.*?(\d+)天到期/,
                        /(\d+)天到期/,
                        /到期.*?(\d+)天/,
                        /(\d+)天/
                    ];
                    
                    for (const pattern of daysPatterns) {
                        const daysMatch = allValues.match(pattern);
                        if (daysMatch) {
                            daysToExpiry = parseInt(daysMatch[1]);
                            console.log('✅ 从API CSV提取到到期天数:', daysToExpiry, '使用模式:', pattern);
                            break;
                        }
                    }
                    
                    // 改进的标的价格检测逻辑
                    if (csvData.length > 2) {
                        console.log('开始检测标的价格...');
                        
                        // 方法1：基于Delta=0.5上下期权的加权策略
                        console.log('开始使用Delta=0.5加权策略估算标的价格...');
                        
                        // 收集所有看涨期权的Delta和行权价数据
                        const callOptionsData = [];
                        for (let i = 0; i < csvData.length; i++) {
                            const row = csvData[i];
                            if (row && row['行权价'] && row['Delta']) {
                                const strike = parseFloat(row['行权价']);
                                const delta = parseFloat(row['Delta']);
                                
                                if (!isNaN(strike) && !isNaN(delta) && strike > 50 && strike < 2000 && delta > 0) {
                                    callOptionsData.push({ strike, delta });
                                }
                            }
                        }
                        
                        if (callOptionsData.length > 0) {
                            console.log(`找到 ${callOptionsData.length} 个看涨期权数据点`);
                            
                            // 按Delta排序
                            callOptionsData.sort((a, b) => a.delta - b.delta);
                            
                            // 寻找Delta=0.5上下最近的期权
                            let upperOption = null;  // Delta > 0.5
                            let lowerOption = null;  // Delta < 0.5
                            
                            // 找到Delta > 0.5的最小值
                            for (const option of callOptionsData) {
                                if (option.delta > 0.5) {
                                    upperOption = option;
                                    break;
                                }
                            }
                            
                            // 找到Delta < 0.5的最大值
                            for (let i = callOptionsData.length - 1; i >= 0; i--) {
                                if (callOptionsData[i].delta < 0.5) {
                                    lowerOption = callOptionsData[i];
                                    break;
                                }
                            }
                            
                            console.log('Delta=0.5上下期权:', {
                                upper: upperOption ? `Delta=${upperOption.delta.toFixed(3)}, Strike=${upperOption.strike}` : '无',
                                lower: lowerOption ? `Delta=${lowerOption.delta.toFixed(3)}, Strike=${lowerOption.strike}` : '无'
                            });
                            
                            // 如果找到了上下期权，进行加权计算
                            if (upperOption && lowerOption) {
                                // 计算权重：Delta越接近0.5，权重越大
                                const upperWeight = 1 / Math.abs(upperOption.delta - 0.5);
                                const lowerWeight = 1 / Math.abs(lowerOption.delta - 0.5);
                                const totalWeight = upperWeight + lowerWeight;
                                
                                // 加权平均
                                underlyingPrice = (upperOption.strike * upperWeight + lowerOption.strike * lowerWeight) / totalWeight;
                                
                                                            console.log('✅ Delta加权策略成功：', {
                                upperStrike: upperOption.strike,
                                upperDelta: upperOption.delta,
                                upperWeight: upperWeight.toFixed(4),
                                lowerStrike: lowerOption.strike,
                                lowerDelta: lowerOption.delta,
                                lowerWeight: lowerWeight.toFixed(4),
                                totalWeight: totalWeight.toFixed(4),
                                weightedPrice: underlyingPrice.toFixed(2)
                            });
                            

                                
                            } else if (upperOption || lowerOption) {
                                // 如果只找到一个，直接使用
                                const option = upperOption || lowerOption;
                                underlyingPrice = option.strike;
                                console.log('✅ 使用单个Delta接近0.5的期权行权价:', underlyingPrice, 'Delta:', option.delta);
                            } else {
                                console.log('未找到Delta接近0.5的期权，尝试方法2...');
                                
                                // 方法2：从所有期权的中间行权价推断
                                const strikes = callOptionsData.map(opt => opt.strike);
                                strikes.sort((a, b) => a - b);
                                const midIndex = Math.floor(strikes.length / 2);
                                underlyingPrice = strikes[midIndex];
                                console.log('✅ 方法2成功：从中间行权价推断标的价格:', underlyingPrice, '可用行权价数量:', strikes.length);
                            }
                        } else {
                            console.log('未找到看涨期权数据，尝试方法2...');
                            
                            // 方法2：从所有期权的中间行权价推断
                            const strikes = [];
                            for (let i = 0; i < csvData.length; i++) {
                                const row = csvData[i];
                                if (row && row['行权价']) {
                                    const strike = parseFloat(row['行权价']);
                                    if (!isNaN(strike) && strike > 50 && strike < 2000) {
                                        strikes.push(strike);
                                    }
                                }
                            }
                            
                            if (strikes.length > 0) {
                                strikes.sort((a, b) => a - b);
                                const midIndex = Math.floor(strikes.length / 2);
                                underlyingPrice = strikes[midIndex];
                                console.log('✅ 方法2成功：从中间行权价推断标的价格:', underlyingPrice, '可用行权价数量:', strikes.length);
                            }
                        }
                        
                        // 方法3：如果还是失败，使用第一个有效的行权价
                        if (!underlyingPrice) {
                            for (let i = 0; i < csvData.length; i++) {
                                const row = csvData[i];
                                if (row && row['行权价']) {
                                    const strike = parseFloat(row['行权价']);
                                    if (!isNaN(strike) && strike > 50 && strike < 2000) {
                                        underlyingPrice = strike;
                                        console.log('✅ 方法3成功：使用第一个有效行权价作为标的价格:', underlyingPrice);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    console.warn('CSV第2行不是对象，跳过到期天数提取');
                }
            }
            
            // 设置合理的默认值
            if (!underlyingPrice) {
                underlyingPrice = 340.00;
                console.log('⚠️ 无法检测标的价格，使用默认值:', underlyingPrice);
            }
            
            if (!daysToExpiry) {
                daysToExpiry = 13;
                console.log('⚠️ 无法检测到期天数，使用默认值:', daysToExpiry);
            }
            
            // 更新全局变量
            window.currentUnderlyingPrice = underlyingPrice;
            window.currentDaysToExpiry = daysToExpiry;
            

            
            // 更新显示信息
            updateInputFields(underlyingPrice, daysToExpiry);
            
            // 直接进行EV分析并显示结果，而不是显示预览
            console.log('开始进行EV分析...');
            
            // 隐藏预览区域
            const importPreview = document.getElementById('import-preview');
            if (importPreview) {
                importPreview.style.display = 'none';
            }
            
            // 计算所有期权的EV
            const optionsWithEV = processedData.map(option => {
                try {
                    const ev = calculateExpectedValue(option, underlyingPrice, daysToExpiry);
                    console.log(`期权 ${option.type} ${option.strike} EV计算:`, ev);
                    return { ...option, ev };
                } catch (error) {
                    console.error(`期权 ${option.type} ${option.strike} EV计算失败:`, error);
                    return { ...option, ev: null };
                }
            }).filter(option => option.ev !== null); // 过滤掉计算失败的期权
            
            // 按EV排序
            const sortedOptions = optionsWithEV.sort((a, b) => b.ev.expectedValue - a.ev.expectedValue);
            
            // 显示EV分析结果
            if (optionsWithEV.length > 0) {
                showEVResults(sortedOptions);
                console.log(`✅ 成功显示 ${optionsWithEV.length} 个期权的EV分析结果`);
            } else {
                console.warn('⚠️ 没有可显示的期权EV分析结果');
                showError('期权EV计算失败，请检查数据格式');
            }
            
            // 确保结果区域可见
            const resultsSection = document.getElementById('results-section');
            if (resultsSection) {
                resultsSection.style.display = 'block';
                console.log('✅ 结果区域已设置为可见');
            } else {
                console.error('❌ 未找到结果区域元素');
            }
            
            console.log('✅ API数据获取和EV分析完成');
            
        } else {
            throw new Error(result.message || 'API返回错误');
        }
        
    } catch (error) {
        console.error('API调用失败:', error);
        
        // 更新状态显示错误
        statusText.textContent = `❌ 获取失败: ${error.message}`;
        apiStatus.style.background = '#f8d7da';
        apiStatus.style.color = '#721c24';
        apiStatus.style.border = '1px solid #f5c6cb';
    }
}

// 显示错误信息
function showError(message) {
    const apiStatus = document.getElementById('api-status');
    const statusText = document.getElementById('status-text');
    
    if (apiStatus && statusText) {
        apiStatus.style.display = 'block';
        statusText.textContent = `❌ ${message}`;
        apiStatus.style.background = '#f8d7da';
        apiStatus.style.color = '#721c24';
        apiStatus.style.border = '1px solid #f5c6cb';
    }
}
