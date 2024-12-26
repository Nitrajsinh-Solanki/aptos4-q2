import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography, Tabs, Space } from 'antd';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos";
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TabPane } = Tabs;

interface AptTransferProps {
  marketplaceAddr: string;
}

const AptTransfer: React.FC<AptTransferProps> = ({ marketplaceAddr }) => {
  const { signAndSubmitTransaction, account } = useWallet();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [recipients, setRecipients] = useState<{ address: string; amount: string }[]>([{ address: '', amount: '' }]);

  const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");

  const handleSingleTransfer = async (values: {
    recipient: string;
    amount: string;
  }) => {
    if (!account) {
      message.error("Please connect your wallet first!");
      return;
    }

    try {
      setLoading(true);
      const amountInOctas = Math.floor(parseFloat(values.amount) * 100000000);

      if (amountInOctas <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::transfer_apt`,
        type_arguments: [],
        arguments: [values.recipient, amountInOctas.toString()]
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      await client.waitForTransaction(response.hash);

      message.success("APT transferred successfully!");
      form.resetFields();
    } catch (error: any) {
      message.error(`Transfer failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchTransfer = async () => {
    if (!account) {
      message.error("Please connect your wallet first!");
      return;
    }

    try {
      setLoading(true);
      const validRecipients = recipients.filter(r => r.address && r.amount);
      
      const recipientAddresses = validRecipients.map(r => r.address);
      const amounts = validRecipients.map(r => 
        Math.floor(parseFloat(r.amount) * 100000000).toString()
      );

      const payload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::batch_transfer_apt`,
        type_arguments: [],
        arguments: [recipientAddresses, amounts]
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      await client.waitForTransaction(response.hash);

      message.success("Batch transfer completed successfully!");
      setRecipients([{ address: '', amount: '' }]);
    } catch (error: any) {
      message.error(`Batch transfer failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = () => {
    setRecipients([...recipients, { address: '', amount: '' }]);
  };

  const removeRecipient = (index: number) => {
    const newRecipients = recipients.filter((_, i) => i !== index);
    setRecipients(newRecipients);
  };

  return (
    <Card style={{ maxWidth: 800, margin: '20px auto', padding: '20px' }}>
      <Title level={3}>APT Transfer</Title>
      <Tabs defaultActiveKey="single">
        <TabPane tab="Single Transfer" key="single">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSingleTransfer}
          >
            <Form.Item
              label="Recipient Address"
              name="recipient"
              rules={[
                { required: true, message: 'Please enter recipient address!' },
                { 
                  pattern: /^0x[a-fA-F0-9]{64}$/,
                  message: 'Please enter a valid Aptos address!'
                }
              ]}
            >
              <Input placeholder="0x..." />
            </Form.Item>

            <Form.Item
              label="Amount (APT)"
              name="amount"
              rules={[
                { required: true, message: 'Please enter amount!' },
                { 
                  pattern: /^\d*\.?\d*$/,
                  message: 'Please enter a valid number!'
                }
              ]}
            >
              <Input type="number" step="0.000000001" min="0" placeholder="0.0" />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                disabled={!account}
                block
              >
                {loading ? 'Processing Transfer...' : 'Transfer APT'}
              </Button>
            </Form.Item>
          </Form>
        </TabPane>

        <TabPane tab="Batch Transfer" key="batch">
          <Space direction="vertical" style={{ width: '100%' }}>
            {recipients.map((recipient, index) => (
              <Card key={index} size="small">
                <Space align="baseline">
                  <Form.Item
                    label="Address"
                    required
                    style={{ margin: 0, flex: 2 }}
                  >
                    <Input 
                      placeholder="0x..."
                      value={recipient.address}
                      onChange={(e) => {
                        const newRecipients = [...recipients];
                        newRecipients[index].address = e.target.value;
                        setRecipients(newRecipients);
                      }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Amount"
                    required
                    style={{ margin: 0, flex: 1 }}
                  >
                    <Input 
                      type="number"
                      placeholder="0.0"
                      value={recipient.amount}
                      onChange={(e) => {
                        const newRecipients = [...recipients];
                        newRecipients[index].amount = e.target.value;
                        setRecipients(newRecipients);
                      }}
                    />
                  </Form.Item>
                  <Button 
                    type="text" 
                    danger 
                    icon={<MinusOutlined />}
                    onClick={() => removeRecipient(index)}
                    disabled={recipients.length === 1}
                  />
                </Space>
              </Card>
            ))}

            <Space>
              <Button 
                type="dashed" 
                onClick={addRecipient} 
                icon={<PlusOutlined />}
              >
                Add Recipient
              </Button>
              <Button 
                type="primary"
                onClick={handleBatchTransfer}
                loading={loading}
                disabled={!account}
              >
                Execute Batch Transfer
              </Button>
            </Space>
          </Space>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default AptTransfer;
