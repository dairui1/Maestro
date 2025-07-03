.PHONY: build run test clean deps

# 变量定义
BINARY_NAME=claude-api
GO=go
GOFLAGS=-v

# 构建
build:
	$(GO) build $(GOFLAGS) -o $(BINARY_NAME) .

# 运行
run:
	$(GO) run main.go -debug

# 运行（带配置文件）
run-with-config:
	$(GO) run main.go -config config.json -debug

# 测试
test:
	$(GO) test -v ./...

# 安装依赖
deps:
	$(GO) mod download
	$(GO) mod tidy

# 清理
clean:
	rm -f $(BINARY_NAME)
	$(GO) clean

# 格式化代码
fmt:
	$(GO) fmt ./...

# 检查代码
lint:
	golangci-lint run

# 构建所有平台
build-all:
	GOOS=darwin GOARCH=amd64 $(GO) build -o $(BINARY_NAME)-darwin-amd64 .
	GOOS=darwin GOARCH=arm64 $(GO) build -o $(BINARY_NAME)-darwin-arm64 .
	GOOS=linux GOARCH=amd64 $(GO) build -o $(BINARY_NAME)-linux-amd64 .
	GOOS=windows GOARCH=amd64 $(GO) build -o $(BINARY_NAME)-windows-amd64.exe .