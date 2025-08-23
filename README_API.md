# 富途期权链查询API服务

基于FastAPI的期权链数据查询和CSV生成服务，提供RESTful API接口。

## 🚀 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 启动服务

```bash
# 使用启动脚本（推荐）
./start_api.sh

# 或直接启动
python3 option_chain_api.py
```

### 3. 访问服务

- **服务地址**: http://localhost:8000
- **API文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/api/health

## 📚 API接口说明

### 基础信息

- **GET** `/` - 服务信息
- **GET** `/api/health` - 健康检查
- **GET** `/api/stocks` - 获取支持的股票列表

### 核心功能

#### 1. 获取期权到期日期

```
GET /api/expiration-dates/{stock_code}
```

**参数**:
- `stock_code`: 股票代码 (如: HK.00700, US.TSLA)

**示例**:
```bash
curl "http://localhost:8000/api/expiration-dates/US.TSLA"
```

#### 2. 查询期权链数据

```
POST /api/option-chain
```

**请求体**:
```json
{
    "stock_code": "US.TSLA",
    "target_date": "2025-08-29",
    "option_type": "ALL",
    "option_cond_type": "ALL"
}
```

**示例**:
```bash
curl -X POST "http://localhost:8000/api/option-chain" \
     -H "Content-Type: application/json" \
     -d '{"stock_code": "US.TSLA", "target_date": "2025-08-29"}'
```

#### 3. 生成CSV数据

```
POST /api/generate-csv
```

**请求体**: 与查询期权链相同

**返回**: JSON格式的CSV数据

**响应格式**:
```json
{
    "success": true,
    "message": "CSV数据生成成功",
    "data": {
        "filename": "US_TSLA_20250822_20250823190928.csv",
        "csv_content": "时间价值,盈利概率,Vega,Theta...",
        "rows": 236,
        "stock_code": "US.TSLA",
        "target_date": "2025-08-22"
    }
}
```

**示例**:
```bash
curl -X POST "http://localhost:8000/api/generate-csv" \
     -H "Content-Type: application/json" \
     -d '{"stock_code": "US.TSLA", "target_date": "2025-08-22"}'
```

## 🎯 支持的股票

### 港股 (HK)
- 腾讯 (HK.00700)
- 阿里巴巴 (HK.09988)
- 美团 (HK.03690)
- 小米 (HK.01810)
- 京东 (HK.09618)
- 网易 (HK.09999)
- 百度 (HK.09888)

### 美股 (US)
- 特斯拉 (US.TSLA)
- 苹果 (US.AAPL)
- 微软 (US.MSFT)
- 谷歌 (US.GOOGL)
- 亚马逊 (US.AMZN)
- 拼多多 (US.PDD)
- 英伟达 (US.NVDA)
- Coinbase (US.COIN)

### A股 (CN)
- 贵州茅台 (CN.600519)
- 平安银行 (CN.000001)

## 🔧 配置说明

### 富途OpenD配置

- **主机**: 127.0.0.1
- **端口**: 11111
- **协议**: TCP

确保富途OpenD已启动并监听指定端口。

### 服务配置

- **监听地址**: 0.0.0.0
- **端口**: 8000
- **自动重载**: 启用
- **日志级别**: info

## 📊 数据格式

### 期权链查询响应

```json
{
    "success": true,
    "message": "期权链数据查询成功",
    "data": {
        "stock_code": "US.TSLA",
        "target_date": "2025-08-29",
        "total_options": 50,
        "call_options": 25,
        "put_options": 25,
        "strike_price_range": {
            "min": 200.0,
            "max": 300.0
        },
        "options": [...]
    }
}
```

### CSV文件格式

生成的CSV文件包含29列，包括：
- 时间价值、盈利概率、Greeks (Delta, Gamma, Theta, Vega)
- 未平仓数、成交量、涨跌幅
- 最新价、中间价、隐含波动率
- 买入价、卖出价、行权价

## 🚨 注意事项

1. **富途OpenD连接**: 确保富途OpenD已启动并正常运行
2. **网络权限**: 服务需要访问富途API的网络权限
3. **数据准确性**: 期权数据来源于富途API，请以实际交易数据为准
4. **临时文件**: CSV文件会临时保存，5分钟后自动清理

## 🐛 故障排除

### 常见问题

1. **连接失败**: 检查富途OpenD是否启动
2. **端口占用**: 确保8000端口未被占用
3. **依赖缺失**: 运行 `pip3 install -r requirements.txt`
4. **权限问题**: 确保脚本有执行权限

### 日志查看

服务运行时会输出详细日志，包括：
- 连接状态
- 查询进度
- 错误信息

## 📞 技术支持

如遇到问题，请检查：
1. 富途OpenD连接状态
2. 服务日志输出
3. 网络连接状态
4. Python环境配置
