#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
富途期权链查询API服务
基于FastAPI的期权链数据查询和CSV生成服务
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
import asyncio
import os
import tempfile
from datetime import datetime
import json

# 导入富途API相关模块
from futu import *
import pandas as pd
import re

# 创建FastAPI应用
app = FastAPI(
    title="富途期权链查询API",
    description="提供期权链数据查询和CSV生成服务",
    version="1.0.0"
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据模型
class OptionChainRequest(BaseModel):
    """期权链查询请求模型"""
    stock_code: str
    target_date: str
    option_type: Optional[str] = "ALL"  # ALL, CALL, PUT
    option_cond_type: Optional[str] = "ALL"  # ALL, ITM, OTM, ATM

class OptionChainResponse(BaseModel):
    """期权链查询响应模型"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class StockInfo(BaseModel):
    """股票信息模型"""
    code: str
    name: str
    market: str

# 全局变量
stock_mapping = {
    '腾讯': 'HK.00700',
    '阿里巴巴': 'HK.09988',
    '美团': 'HK.03690',
    '小米': 'HK.01810',
    '京东': 'HK.09618',
    '网易': 'HK.09999',
    '百度': 'HK.09888',
    '拼多多': 'US.PDD',
    'PDD': 'US.PDD',
    '特斯拉': 'US.TSLA',
    '苹果': 'US.AAPL',
    '微软': 'US.MSFT',
    '谷歌': 'US.GOOGL',
    '亚马逊': 'US.AMZN',
    '英伟达': 'US.NVDA',
    'NVDA': 'US.NVDA',
    'Coinbase': 'US.COIN',
    'COIN': 'US.COIN',
    '茅台': 'CN.600519',
    '平安': 'CN.000001'
}

# 工具函数
def get_stock_code(stock_input: str) -> str:
    """获取股票代码"""
    if stock_input.startswith(('HK.', 'US.', 'CN.')):
        return stock_input
    
    if stock_input in stock_mapping:
        return stock_mapping[stock_input]
    
    raise ValueError(f"未找到股票 '{stock_input}' 的代码映射")

def validate_stock_code(stock_code: str) -> bool:
    """验证股票代码格式"""
    return bool(re.match(r'^(HK|US|CN)\.[A-Z0-9]+$', stock_code))

def get_option_chain_data(code: str, target_date: str) -> Optional[pd.DataFrame]:
    """获取指定到期日的期权链数据"""
    try:
        quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
        
        # 查询指定到期日的期权链
        ret, data = quote_ctx.get_option_chain(
            code=code, 
            start=target_date, 
            end=target_date
        )
        
        if ret == RET_OK and data.shape[0] > 0:
            # 获取期权合约代码列表用于订阅
            option_codes = data['code'].tolist()
            
            # 订阅期权实时数据
            print(f"📡 正在订阅 {len(option_codes)} 个期权合约的实时数据...")
            
            # 分批订阅，避免一次性订阅过多
            batch_size = 20  # 减小批次大小，避免订阅失败
            for i in range(0, len(option_codes), batch_size):
                batch_codes = option_codes[i:i+batch_size]
                # 只订阅实时报价数据，避免摆盘数据订阅失败
                ret_sub = quote_ctx.subscribe(
                    batch_codes, 
                    [SubType.QUOTE],  # 只订阅报价数据
                    is_first_push=True,  # 订阅成功后立即推送一次缓存数据
                    subscribe_push=True,  # 订阅后推送
                    session=Session.ALL   # 美股全时段数据
                )
                if ret_sub == RET_OK:
                    print(f"✅ 成功订阅第 {i//batch_size + 1} 批 ({len(batch_codes)} 个合约)")
                else:
                    print(f"⚠️  第 {i//batch_size + 1} 批订阅失败，错误码: {ret_sub}")
                    # 尝试单个订阅
                    for code in batch_codes:
                        ret_single = quote_ctx.subscribe([code], [SubType.QUOTE])
                        if ret_single == RET_OK:
                            print(f"  ✅ 单个订阅成功: {code}")
                        else:
                            print(f"  ❌ 单个订阅失败: {code}")
            
            # 等待数据推送，根据文档建议至少等待1分钟
            print("⏳ 等待实时数据推送...")
            import time
            time.sleep(3)  # 等待3秒让数据开始推送
            
            # 获取实时数据
            enriched_data = enrich_option_data(quote_ctx, data)
            
            # 取消订阅以释放额度
            print("🔄 正在取消订阅以释放额度...")
            quote_ctx.unsubscribe_all()
            
            quote_ctx.close()
            return enriched_data
        else:
            quote_ctx.close()
            return None
            
    except Exception as e:
        print(f"期权链查询时出错: {str(e)}")
        return None

def enrich_option_data(quote_ctx: OpenQuoteContext, df: pd.DataFrame) -> pd.DataFrame:
    """使用实时数据丰富期权数据"""
    enriched_df = df.copy()
    
    # 添加实时数据列
    enriched_df['last_price'] = 0.0
    enriched_df['open_price'] = 0.0
    enriched_df['high_price'] = 0.0
    enriched_df['low_price'] = 0.0
    enriched_df['prev_close_price'] = 0.0
    enriched_df['volume'] = 0
    enriched_df['turnover'] = 0.0
    enriched_df['turnover_rate'] = 0.0
    enriched_df['amplitude'] = 0
    enriched_df['open_interest'] = 0
    enriched_df['implied_volatility'] = 0.0
    enriched_df['delta'] = 0.0
    enriched_df['gamma'] = 0.0
    enriched_df['vega'] = 0.0
    enriched_df['theta'] = 0.0
    enriched_df['rho'] = 0.0
    enriched_df['premium'] = 0.0
    
    print("📊 正在获取实时数据...")
    
    # 批量获取实时报价，提高效率
    all_codes = df['code'].tolist()
    
    # 使用get_stock_quote获取更丰富的实时数据
    ret, quote_data = quote_ctx.get_stock_quote(all_codes)
    if ret == RET_OK and not quote_data.empty:
        print(f"✅ 成功获取 {len(quote_data)} 个合约的实时报价")
        
        # 创建代码到数据的映射
        quote_dict = {}
        for _, row in quote_data.iterrows():
            quote_dict[row['code']] = row
        
        # 更新数据
        for idx, row in df.iterrows():
            code = row['code']
            if code in quote_dict:
                quote_row = quote_dict[code]
                enriched_df.at[idx, 'last_price'] = quote_row.get('last_price', 0.0)
                enriched_df.at[idx, 'open_price'] = quote_row.get('open_price', 0.0)
                enriched_df.at[idx, 'high_price'] = quote_row.get('high_price', 0.0)
                enriched_df.at[idx, 'low_price'] = quote_row.get('low_price', 0.0)
                enriched_df.at[idx, 'prev_close_price'] = quote_row.get('prev_close_price', 0.0)
                enriched_df.at[idx, 'volume'] = quote_row.get('volume', 0)
                enriched_df.at[idx, 'turnover'] = quote_row.get('turnover', 0.0)
                enriched_df.at[idx, 'turnover_rate'] = quote_row.get('turnover_rate', 0.0)
                enriched_df.at[idx, 'amplitude'] = quote_row.get('amplitude', 0)
                enriched_df.at[idx, 'open_interest'] = quote_row.get('open_interest', 0)
                enriched_df.at[idx, 'implied_volatility'] = quote_row.get('implied_volatility', 0.0)
                enriched_df.at[idx, 'delta'] = quote_row.get('delta', 0.0)
                enriched_df.at[idx, 'gamma'] = quote_row.get('gamma', 0.0)
                enriched_df.at[idx, 'vega'] = quote_row.get('vega', 0.0)
                enriched_df.at[idx, 'theta'] = quote_row.get('theta', 0.0)
                enriched_df.at[idx, 'rho'] = quote_row.get('rho', 0.0)
                enriched_df.at[idx, 'premium'] = quote_row.get('premium', 0.0)
    
    print("✅ 实时数据获取完成")
    return enriched_df

def generate_csv_data(df: pd.DataFrame, target_date: str) -> List[List[str]]:
    """生成期权链CSV数据 - 每个行权价一行，左边看涨期权，右边看跌期权"""
    if df is None or df.empty:
        return []
    
    # 计算到期天数
    try:
        target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
        today = datetime.now().date()
        days_to_expiry = (target_date_obj - today).days
        expiry_info = f"到期日：{target_date}(W) {days_to_expiry}天到期"
    except:
        expiry_info = f"到期日：{target_date}(W) 6天到期"
    
    # 创建CSV数据
    csv_data = []
    
    # 添加表头
    header = [
        "时间价值", "盈利概率", "Vega", "Theta", "Gamma", "Delta",  # 时间价值到Delta
        "未平仓数", "成交量", "涨跌幅", "最新价", "中间价", "隐含波动率",  # 未平仓数到隐含波动率
        "卖出价", "买入价", "行权价",  # 卖出价、买入价、行权价
        "买入价", "卖出价", "隐含波动率", "中间价", "最新价", "涨跌幅",  # 买入价、卖出价、隐含波动率、中间价、最新价、涨跌幅
        "成交量", "未平仓数", "Delta", "Gamma", "Theta", "Vega", "盈利概率", "时间价值"  # 成交量到时间价值
    ]
    csv_data.append(header)
    
    # 添加到期日信息行
    info_row = [""] * 14 + [expiry_info] + [""] * 14
    csv_data.append(info_row)
    
    # 按行权价分组，每个行权价生成一行
    strike_groups = df.groupby('strike_price')
    
    for strike_price, group in strike_groups:
        # 获取该行权价的看涨和看跌期权
        call_options = group[group['option_type'] == 'CALL']
        put_options = group[group['option_type'] == 'PUT']
        
        # 如果该行权价没有看涨或看跌期权，跳过
        if call_options.empty or put_options.empty:
            continue
            
        # 取第一个看涨期权和第一个看跌期权的数据
        call_option = call_options.iloc[0]
        put_option = put_options.iloc[0]
        
        # 计算涨跌幅
        call_change_pct = f"{((call_option['last_price'] - call_option['prev_close_price']) / call_option['prev_close_price'] * 100):.2f}%" if call_option['prev_close_price'] != 0 else "0.00%"
        put_change_pct = f"{((put_option['last_price'] - put_option['prev_close_price']) / put_option['prev_close_price'] * 100):.2f}%" if put_option['prev_close_price'] != 0 else "0.00%"
        
        # 计算中间价
        call_mid_price = (call_option['high_price'] + call_option['low_price']) / 2
        put_mid_price = (put_option['high_price'] + put_option['low_price']) / 2
        
        # 生成CSV行：左边是看涨期权，右边是看跌期权，中间是行权价
        csv_row = [
            # 左边：看涨期权信息
            f"{call_option['premium']:.2f}", f"{call_change_pct}", f"{call_option['vega']:.4f}", f"{call_option['theta']:.4f}", f"{call_option['gamma']:.4f}", f"{call_option['delta']:.4f}",  # 时间价值到Delta
            f"{call_option['open_interest']}张", f"{call_option['volume']}张", f"{call_change_pct}", f"{call_option['last_price']:.2f}", f"{call_mid_price:.3f}", f"{call_option['implied_volatility']:.2f}%",  # 未平仓数到隐含波动率
            f"{call_option['high_price']:.2f}", f"{call_option['low_price']:.2f}", str(strike_price),  # 卖出价、买入价、行权价
            # 右边：看跌期权信息
            f"{put_option['low_price']:.2f}", f"{put_option['high_price']:.2f}", f"{put_option['implied_volatility']:.2f}%", f"{put_mid_price:.3f}", f"{put_option['last_price']:.2f}", f"{put_change_pct}",  # 买入价、卖出价、隐含波动率、中间价、最新价、涨跌幅
            f"{put_option['volume']}张", f"{put_option['open_interest']}张", f"{put_option['delta']:.4f}", f"{put_option['gamma']:.4f}", f"{put_option['theta']:.4f}", f"{put_option['vega']:.4f}", f"{put_change_pct}", f"{put_option['premium']:.2f}"  # 成交量到时间价值
        ]
        
        csv_data.append(csv_row)
    
    return csv_data

def save_csv_to_temp(csv_data: List[List[str]], code: str, target_date: str) -> str:
    """保存CSV到临时文件并返回文件路径"""
    # 创建临时文件
    stock_name = code.replace('.', '_')
    date_str = target_date.replace('-', '')
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{stock_name}_{date_str}_{timestamp}.csv"
    
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, filename)
    
    try:
        with open(file_path, 'w', encoding='utf-8-sig') as f:
            for row in csv_data:
                f.write(','.join(f'"{cell}"' for cell in row) + '\n')
        
        return file_path
        
    except Exception as e:
        print(f"保存CSV文件时出错: {str(e)}")
        return ""

# API路由
@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "富途期权链查询API服务",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "查询期权链": "/api/option-chain",
            "获取到期日期": "/api/expiration-dates/{stock_code}",
            "生成CSV": "/api/generate-csv",
            "下载CSV文件": "/api/download-csv",
            "获取股票列表": "/api/stocks"
        },
        "csv_features": {
            "generate_csv": "生成CSV数据并返回JSON响应，可选择保存到本地",
            "download_csv": "直接下载CSV文件，支持浏览器下载",
            "local_save": "支持自定义保存路径，自动创建目录"
        }
    }

@app.get("/api/stocks", response_model=List[StockInfo])
async def get_stocks():
    """获取支持的股票列表"""
    stocks = []
    for name, code in stock_mapping.items():
        market = code.split('.')[0]
        stocks.append(StockInfo(code=code, name=name, market=market))
    
    # 添加一些额外的股票代码
    additional_stocks = [
        StockInfo(code="HK.00700", name="腾讯控股", market="HK"),
        StockInfo(code="US.AAPL", name="苹果公司", market="US"),
        StockInfo(code="CN.600519", name="贵州茅台", market="CN")
    ]
    
    return stocks + additional_stocks

@app.get("/api/expiration-dates/{stock_code}")
async def get_expiration_dates(stock_code: str):
    """获取指定股票的期权到期日期列表"""
    try:
        # 验证股票代码
        if not validate_stock_code(stock_code):
            raise HTTPException(status_code=400, detail="股票代码格式不正确")
        
        # 获取期权到期日期
        quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
        ret, data = quote_ctx.get_option_expiration_date(code=stock_code)
        quote_ctx.close()
        
        if ret != RET_OK:
            raise HTTPException(status_code=500, detail=f"获取期权到期日期失败: {data}")
        
        expiration_dates = data['strike_time'].values.tolist()
        
        return {
            "success": True,
            "stock_code": stock_code,
            "expiration_dates": expiration_dates,
            "count": len(expiration_dates)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取到期日期时出错: {str(e)}")

@app.post("/api/option-chain", response_model=OptionChainResponse)
async def query_option_chain(request: OptionChainRequest):
    """查询期权链数据"""
    try:
        # 处理股票代码
        try:
            stock_code = get_stock_code(request.stock_code)
        except ValueError as e:
            return OptionChainResponse(
                success=False,
                message="股票代码处理失败",
                error=str(e)
            )
        
        # 验证股票代码格式
        if not validate_stock_code(stock_code):
            return OptionChainResponse(
                success=False,
                message="股票代码格式不正确",
                error="请使用格式: 市场.代码 (如: HK.00700, US.AAPL)"
            )
        
        # 获取期权链数据
        df = get_option_chain_data(stock_code, request.target_date)
        
        if df is None:
            return OptionChainResponse(
                success=False,
                message="未找到期权链数据",
                error="请检查股票代码和到期日期是否正确"
            )
        
        # 处理数据
        option_data = []
        for _, row in df.iterrows():
            option_data.append({
                "code": row['code'],
                "name": row['name'],
                "strike_price": float(row['strike_price']),
                "option_type": row['option_type'],
                "strike_time": row['strike_time'],
                "lot_size": int(row['lot_size']),
                "stock_owner": row['stock_owner']
            })
        
        # 统计信息
        call_count = len([opt for opt in option_data if opt['option_type'] == 'CALL'])
        put_count = len([opt for opt in option_data if opt['option_type'] == 'PUT'])
        
        # 行权价范围
        strike_prices = [opt['strike_price'] for opt in option_data]
        min_strike = min(strike_prices) if strike_prices else 0
        max_strike = max(strike_prices) if strike_prices else 0
        
        return OptionChainResponse(
            success=True,
            message="期权链数据查询成功",
            data={
                "stock_code": stock_code,
                "target_date": request.target_date,
                "total_options": len(option_data),
                "call_options": call_count,
                "put_options": put_count,
                "strike_price_range": {
                    "min": min_strike,
                    "max": max_strike
                },
                "options": option_data
            }
        )
        
    except Exception as e:
        return OptionChainResponse(
            success=False,
            message="查询期权链时出错",
            error=str(e)
        )

@app.post("/api/generate-csv")
async def generate_csv(
    request: OptionChainRequest, 
    save_local: bool = Query(False, description="是否保存到本地文件"),
    save_path: Optional[str] = Query("", description="自定义保存路径，留空则使用默认路径")
):
    """生成期权链CSV数据"""
    try:
        # 处理股票代码
        try:
            stock_code = get_stock_code(request.stock_code)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # 验证股票代码格式
        if not validate_stock_code(stock_code):
            raise HTTPException(status_code=400, detail="股票代码格式不正确")
        
        # 获取期权链数据
        df = get_option_chain_data(stock_code, request.target_date)
        
        if df is None:
            raise HTTPException(status_code=404, detail="未找到期权链数据")
        
        # 生成CSV数据
        csv_data = generate_csv_data(df, request.target_date)
        
        if not csv_data:
            raise HTTPException(status_code=500, detail="CSV数据生成失败")
        
        # 将CSV数据转换为字符串
        csv_content = ""
        for row in csv_data:
            csv_content += ','.join(f'"{cell}"' for cell in row) + '\n'
        
        # 生成文件名
        stock_name = stock_code.replace('.', '_')
        date_str = request.target_date.replace('-', '')
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{stock_name}_{date_str}_{timestamp}.csv"
        
        # 如果请求本地保存，则保存到文件
        local_file_path = ""
        if save_local:
            try:
                # 确定保存路径
                if save_path and save_path.strip():
                    # 使用自定义路径
                    if os.path.isdir(save_path):
                        # 如果提供的是目录，在目录下创建文件
                        file_path = os.path.join(save_path, filename)
                    else:
                        # 如果提供的是完整文件路径，直接使用
                        file_path = save_path
                        # 确保目录存在
                        os.makedirs(os.path.dirname(file_path), exist_ok=True)
                else:
                    # 使用默认路径（当前工作目录）
                    current_dir = os.getcwd()
                    file_path = os.path.join(current_dir, filename)
                
                # 保存文件
                with open(file_path, 'w', encoding='utf-8-sig') as f:
                    f.write(csv_content)
                
                local_file_path = file_path
                print(f"✅ 本地文件保存成功: {file_path}")
                
                # 验证文件是否成功创建
                if os.path.exists(file_path):
                    file_size = os.path.getsize(file_path)
                    print(f"📁 文件大小: {file_size} 字节")
                else:
                    print("⚠️ 文件保存后未找到，可能存在权限问题")
                    
            except PermissionError:
                raise HTTPException(status_code=500, detail="权限不足，无法保存文件到指定路径")
            except Exception as e:
                print(f"❌ 本地保存失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"本地文件保存失败: {str(e)}")
        
        return {
            "success": True,
            "message": "CSV数据生成成功",
            "data": {
                "filename": filename,
                "csv_content": csv_content,
                "rows": len(csv_data),
                "stock_code": stock_code,
                "target_date": request.target_date,
                "local_file": local_file_path if save_local else None,
                "file_size": len(csv_content.encode('utf-8-sig')) if save_local else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成CSV时出错: {str(e)}")

@app.post("/api/download-csv")
async def download_csv(
    request: OptionChainRequest,
    background_tasks: BackgroundTasks
):
    """下载期权链CSV文件"""
    try:
        # 处理股票代码
        try:
            stock_code = get_stock_code(request.stock_code)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # 验证股票代码格式
        if not validate_stock_code(stock_code):
            raise HTTPException(status_code=400, detail="股票代码格式不正确")
        
        # 获取期权链数据
        df = get_option_chain_data(stock_code, request.target_date)
        
        if df is None:
            raise HTTPException(status_code=404, detail="未找到期权链数据")
        
        # 生成CSV数据
        csv_data = generate_csv_data(df, request.target_date)
        
        if not csv_data:
            raise HTTPException(status_code=500, detail="CSV数据生成失败")
        
        # 生成文件名
        stock_name = stock_code.replace('.', '_')
        date_str = request.target_date.replace('-', '')
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{stock_name}_{date_str}_{timestamp}.csv"
        
        # 保存到临时文件
        temp_file_path = save_csv_to_temp(csv_data, stock_code, request.target_date)
        
        if not temp_file_path:
            raise HTTPException(status_code=500, detail="临时文件创建失败")
        
        # 设置后台任务，在响应完成后删除临时文件
        background_tasks.add_task(cleanup_temp_file, temp_file_path)
        
        # 返回文件下载响应
        return FileResponse(
            path=temp_file_path,
            filename=filename,
            media_type='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'text/csv; charset=utf-8-sig'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载CSV时出错: {str(e)}")

def cleanup_temp_file(file_path: str):
    """清理临时文件"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"🗑️ 临时文件已清理: {file_path}")
    except Exception as e:
        print(f"⚠️ 清理临时文件失败: {str(e)}")

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "富途期权链查询API"
    }

@app.get("/api/subscription-status")
async def get_subscription_status():
    """获取当前订阅状态"""
    try:
        quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
        
        # 查询订阅状态
        ret, data = quote_ctx.query_subscription()
        
        quote_ctx.close()
        
        if ret == RET_OK:
            return {
                "success": True,
                "message": "订阅状态查询成功",
                "data": data
            }
        else:
            return {
                "success": False,
                "message": f"订阅状态查询失败: {data}",
                "data": None
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"查询订阅状态时出错: {str(e)}",
            "data": None
        }

# 启动服务
if __name__ == "__main__":
    uvicorn.run(
        "option_chain_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # 启用热重载
        log_level="debug",  # 改为debug级别
        reload_dirs=["."],  # 监控当前目录变化
        reload_includes=["*.py"],  # 监控Python文件变化
        reload_excludes=["__pycache__", "*.pyc"],  # 排除缓存文件
        access_log=True,  # 启用访问日志
        use_colors=True  # 启用彩色输出
    )
