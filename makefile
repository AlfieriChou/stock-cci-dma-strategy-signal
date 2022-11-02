################################################
APP ?= stock-cci-dma-strategy-signal

install:
	pnpm install

stopAndDeleteApp:
	pm2 stop ${APP}
	pm2 delete ${APP}

startApp: stopAndDeleteApp
	pnpm install
	pm2 start app.js --name ${APP}
