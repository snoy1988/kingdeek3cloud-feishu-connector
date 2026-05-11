import './App.css';
import { useState, useEffect } from 'react';
import { bitable } from '@lark-base-open/connector-api';
import { Button, Form, Input, message, Space, Divider } from 'antd';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import FormSelect from './FormSelect';
import { API_ENDPOINTS } from './config';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<ConfigForm />} />
                <Route path="/form-select" element={<FormSelect />} />
            </Routes>
        </BrowserRouter>
    );
}

function ConfigForm() {
    const [value, setValue] = useState('');
    const [userId, setUserId] = useState('');
    const [tenantKey, setTenantKey] = useState('');
    const [loginSuccess, setLoginSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [isCreate, setIsCreate] = useState(true); // 是否为新增模式

    console.log('test');
    useEffect(() => {
        // 判断是新增还是修改
        const params = window.location.search.slice(1).split('&');
        const isNew = params.some(param => {
            const [key, value] = param.split('=');
            return key === 'isNew' && value;
        });
        setIsCreate(isNew);
        console.log('当前模式:', isNew ? '新增' : '修改');

        // 获取已有配置
        bitable.getConfig().then(config => {
            console.log('pre sync config', config);
            setValue(config?.value || '');
            
            // 如果是修改模式，自动填充配置
            if (!isNew && config && config.ServerUrl) {
                console.log('自动填充已有配置:', config);
                form.setFieldsValue({
                    ServerUrl: config.ServerUrl,
                    AcctID: config.AcctID,
                    UserName: config.UserName || '',
                    AppID: config.AppID,
                    AppSec: config.AppSec,
                    LCID: config.LCID || '2052',
                    OrgNum: config.OrgNum || ''
                });
                message.success('已加载已有配置，请重新登录验证');
            }
        });
        bitable.getUserId().then(id => {
            console.log('userId', id);
            setUserId(id);
        });
        bitable.getTenantKey().then(key => {
            console.log('tenantKey', key);
            setTenantKey(key);
        })
    }, [])

    const handleSaveConfig = (config: any) => {
        console.log('config', config)
        // 设置非必填项的默认值
        if (!config['OrgNum']) {
            config['OrgNum'] = '';
        }
        if (!config['LCID'] || config['LCID'] === '') {
            config['LCID'] = '2052';
        }
        
        console.log('准备跳转到表单选择页面');
        console.log('当前模式:', isCreate ? '新增' : '修改');
        
        // 直接跳转到表单选择页面，同时传递 sessionId、模式和配置
        navigate('/form-select', { state: { sessionId, isCreate, config } });
    }

    // 生成签名（按照 C# 的 SHA256 加密方式）
    const generateSign = async (acctId: string, userName: string, appId: string, appSec: string, timestamp: string): Promise<string> => {
        // 将参数放入数组
        const arr = [acctId, userName, appId, appSec, timestamp];
        
        // 按照 StringComparer.Ordinal 排序（JavaScript 的默认排序）
        arr.sort();
        
        // 拼接成字符串
        const str = arr.join('');
        
        // 使用 SHA256 加密
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const buffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(buffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    }

    // 登录测试
    const handleLoginTest = async (values: any) => {
        setLoading(true);
        try {
            console.log('=== 登录请求开始 ===');
            console.log('表单值:', values);
            
            // 调用后端代理接口进行登录
            const backendUrl = API_ENDPOINTS.LOGIN_KINGDEE;
            
            console.log('请求后端代理:', {
                backendUrl,
                data: values
            });
            debugger
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values)
            });
            
            console.log('响应状态:', response.status);
            console.log('响应头:', response.headers);
            
            // 先获取响应文本，看看返回的是什么
            const responseText = await response.text();
            console.log('原始响应:', responseText);
            
            // 尝试解析 JSON
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON 解析失败:', parseError);
                console.error('响应内容类型:', response.headers.get('content-type'));
                throw new Error(`服务器返回了非 JSON 格式的数据：${responseText.substring(0, 200)}`);
            }
            
            console.log('后端响应:', result);
            
            // 检查登录结果
            if (result.LoginResultType === 1) {
                message.success('登录测试成功！');
                setLoginSuccess(true);
                // 保存 SessionId 供后续接口使用
                if (result.KDSVCSessionId) {
                    setSessionId(result.KDSVCSessionId);
                    console.log('SessionId:', result.KDSVCSessionId);
                }
            } else {
                message.error(`登录测试失败：${result.Message || '未知错误'}`);
                setLoginSuccess(false);
            }
        } catch (error: any) {
            console.error('=== 登录错误 ===');
            console.error('登录请求失败:', error);
            console.error('错误类型:', error.constructor.name);
            message.error(`登录请求失败：${error.message}`);
            setLoginSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#ffffff',
            padding: '16px'
        }}>
            {/* 内容卡片 */}
            <div style={{
                maxWidth: '100%',
                background: '#ffffff',
                borderTop: '3px solid transparent',
                borderImage: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%) 1',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.15)',
                paddingBottom: '8px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h1 style={{ 
                        fontSize: '18px', 
                        fontWeight: 600,
                        color: '#1a1a1a',
                        margin: '0 0 4px 0'
                    }}>
                        🌟 金蝶云星空连接器
                    </h1>
                    <p style={{ 
                        fontSize: '12px', 
                        color: '#999',
                        margin: 0
                    }}>
                        配置金蝶 ERP 系统连接参数
                    </p>
                </div>
                
                
                <Form
                form={form}
                name="basic"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                layout="horizontal"
                style={{ maxWidth: '100%' }}
                initialValues={{ 
                    remember: true,
                    LCID: '2052'
                }}
                onFinish={handleSaveConfig}
                autoComplete="off"
                size="middle"
            >
                {/* 必填项 */}
                <Form.Item
                    label={<span style={{ fontWeight: 500 }}>🌐 服务器地址</span>}
                    name="ServerUrl"
                    rules={[{ required: true, message: '请输入星空域名' }]}
                    extra={<span style={{ color: '#999', fontSize: '11px' }}>金蝶云星空系统的访问地址</span>}
                >
                    <Input placeholder="例如：http://kingdee.example.com" size="middle" />
                </Form.Item>
                            
                <Form.Item
                    label={<span style={{ fontWeight: 500 }}>🏢 账套 ID</span>}
                    name="AcctID"
                    rules={[{ required: true, message: '请输入账套 ID' }]}
                    extra={<span style={{ color: '#999', fontSize: '11px' }}>金蝶系统中的账套唯一标识</span>}
                >
                    <Input placeholder="请输入账套 ID" size="middle" />
                </Form.Item>
                            
                <Form.Item
                    label={<span style={{ fontWeight: 500 }}>🔑 应用 ID</span>}
                    name="AppID"
                    rules={[{ required: true, message: '请输入应用 ID' }]}
                    extra={<span style={{ color: '#999', fontSize: '11px' }}>在金蝶云开放平台创建的应用 ID</span>}
                >
                    <Input placeholder="请输入应用 ID" size="middle" />
                </Form.Item>
                            
                <Form.Item
                    label={<span style={{ fontWeight: 500 }}>🔐 应用密钥</span>}
                    name="AppSec"
                    rules={[{ required: true, message: '请输入应用密钥' }]}
                    extra={<span style={{ color: '#999', fontSize: '11px' }}>与 appId 配对使用的密钥</span>}
                >
                    <Input.Password placeholder="请输入应用密钥" size="middle" />
                </Form.Item>
            
                {/* 非必填项 */}
                <Form.Item
                    label={<span style={{ fontWeight: 500 }}>📋 组织编码</span>}
                    name="OrgNum"
                    extra={<span style={{ color: '#999', fontSize: '11px' }}>选填，不填则使用默认组织</span>}
                >
                    <Input placeholder="请输入组织编码（可选）" size="middle" />
                </Form.Item>
                            
                <Form.Item
                    label={<span style={{ fontWeight: 500 }}>🌍 语言编码</span>}
                    name="LCID"
                    extra={<span style={{ color: '#999', fontSize: '11px' }}>选填，默认 2052（简体中文）</span>}
                >
                    <Input placeholder="默认 2052（可选）" size="middle" />
                </Form.Item>
                            
                <Form.Item
                    label={<span style={{ fontWeight: 500 }}>👤 登录账号</span>}
                    name="UserName"
                    rules={[{ required: true, message: '请输入登录账号' }]}
                    extra={<span style={{ color: '#999', fontSize: '11px' }}>用于签名验证</span>}
                >
                    <Input placeholder="请输入登录账号" size="middle" />
                </Form.Item>
                            
                <Divider style={{ margin: '24px 0 16px' }} />
                
                {/* 按钮区域 */}
                <div style={{ padding: '0 8px', marginBottom: '8px' }}>
                    <Space style={{ width: '100%', justifyContent: 'center', gap: '16px' }}>
                        <Button 
                            type="default" 
                            onClick={() => {
                                form.validateFields().then(() => {
                                    const formValues = form.getFieldsValue();
                                    console.log('获取表单值:', formValues);
                                    handleLoginTest(formValues);
                                }).catch((info: any) => {
                                    console.log('验证失败:', info);
                                    message.error('请先填写所有必填项');
                                });
                            }}
                            loading={loading}
                            icon={<i className="anticon">🔍</i>}
                            size="middle"
                            style={{ minWidth: '120px' }}
                        >
                            登录测试
                        </Button>
                        
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            disabled={!loginSuccess}
                            icon={<i className="anticon">➡️</i>}
                            size="middle"
                            style={{ minWidth: '120px' }}
                        >
                            {loginSuccess ? '下一步' : '请先登录测试'}
                        </Button>
                    </Space>
                </div>
            </Form>
            </div>
        </div>
    )
}