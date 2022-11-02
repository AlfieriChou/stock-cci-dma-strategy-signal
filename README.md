# stock-cci-dma-strategy-signal
stock cci dma strategy signal

## 环境要求

需要 NodeJS >= 16 环境

### 安装

```bash
docker-compose up

pnpm install
```

### 配置环境变量.env文件

```env
# mysql
MYSQL_HOST = MYSQL_HOST
MYSQL_USER = MYSQL_USER
MYSQL_PASSWORD = MYSQL_PASSWORD
MYSQL_DB = "stock"
MYSQL_PORT = "3306"

# redis
REDIS_HOST = "127.0.0.1"

# port
PORT = "3000"
```

### 运行

```bash
pnpm dev
```

## 执行策略

### 多因子CCI策略

* 执行时间：
  * 15:20
  * 19:20
* 计算规则：
  * N = 20
  * CCI = (TP-MA_CLOSE)/MD/0.015
  * TP = (HIGH + LOW + CLOSE) / 3
  * MA = MA(CLOSE, N)
  * MD = MA(MA - CLOSE, N)

### 双线多因子MA策略

* 执行时间：
  * 15:40
  * 19:40
* 计算规则：
  * MA(CLOSE, N) - MA(CLOSE, M)
