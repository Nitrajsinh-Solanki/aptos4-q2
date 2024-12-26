import React, { useEffect, useState } from "react";
import {
  Layout,
  Typography,
  Menu,
  Space,
  Button,
  Dropdown,
  message,
  Modal,
} from "antd";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos";
import {
  AccountBookOutlined,
  DownOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import ReceivedOffers from "./ReceivedOffers";

const { Header } = Layout;
const { Text } = Typography;

const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");
const marketplaceAddr =
  "0x3ed23f75dc96ed785388d48d31252e98e3b031fb3cdca6175f0a9c75d4489521";

interface NavBarProps {
  onMintNFTClick: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ onMintNFTClick }) => {
  const { connected, account, network, disconnect } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [isOffersModalVisible, setIsOffersModalVisible] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      if (account) {
        try {
          const resources: any[] = await client.getAccountResources(
            account.address
          );
          const accountResource = resources.find(
            (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
          );
          if (accountResource) {
            const balanceValue = (accountResource.data as any).coin.value;
            setBalance(balanceValue ? parseInt(balanceValue) / 100000000 : 0);
          } else {
            setBalance(0);
          }
        } catch (error) {
          console.error("Error fetching balance:", error);
        }
      }
    };

    if (connected) {
      fetchBalance();
    }
  }, [account, connected]);

  const handleLogout = async () => {
    try {
      await disconnect();
      setBalance(null);
      message.success("Disconnected from wallet");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      message.error("Failed to disconnect from wallet");
    }
  };

  return (
    <Header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#001529",
        padding: "0 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <img
          src="/Aptos_Primary_WHT.png"
          alt="Aptos Logo"
          style={{ height: "30px", marginRight: 16 }}
        />

        <Menu
          theme="dark"
          mode="horizontal"
          defaultSelectedKeys={["marketplace"]}
          style={{
            backgroundColor: "#001529",
            flexGrow: 1,
            flexWrap: "nowrap",
            display: "flex",
          }}
        >
          <Menu.Item key="marketplace">
            <Link to="/" style={{ color: "#fff" }}>
              Marketplace
            </Link>
          </Menu.Item>
          <Menu.Item key="my-collection">
            <Link to="/my-nfts" style={{ color: "#fff" }}>
              My Collection
            </Link>
          </Menu.Item>
          <Menu.Item key="mint-nft" onClick={onMintNFTClick}>
            <span style={{ color: "#fff" }}>Mint NFT</span>
          </Menu.Item>
          <Menu.Item key="auctions">
            <Link to="/auctions" style={{ color: "#fff" }}>
              Auctions
            </Link>
          </Menu.Item>
          <Menu.Item
            key="received-offers"
            onClick={() => setIsOffersModalVisible(true)}
          >
            <span style={{ color: "#fff" }}>Received Offers</span>
          </Menu.Item>
          <Menu.Item key="transfer">
            <Link to="/transfer" style={{ color: "#fff" }}>
              Transfer APT
            </Link>
          </Menu.Item>
        </Menu>
      </div>

      <Space style={{ alignItems: "center" }}>
        {connected && account ? (
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item key="address">
                  <Text strong>Address:</Text> <br />
                  <Text copyable>{account.address}</Text>
                </Menu.Item>
                <Menu.Item key="network">
                  <Text strong>Network:</Text>{" "}
                  {network ? network.name : "Unknown"}
                </Menu.Item>
                <Menu.Item key="balance">
                  <Text strong>Balance:</Text>{" "}
                  {balance !== null ? `${balance} APT` : "Loading..."}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  key="logout"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                >
                  Log Out
                </Menu.Item>
              </Menu>
            }
            trigger={["click"]}
          >
            <Button type="primary">
              Connected <DownOutlined />
            </Button>
          </Dropdown>
        ) : (
          <WalletSelector />
        )}
      </Space>

      <Modal
        title="Received Offers"
        visible={isOffersModalVisible}
        onCancel={() => setIsOffersModalVisible(false)}
        footer={null}
        width={800}
      >
        <ReceivedOffers marketplaceAddr={marketplaceAddr} />
      </Modal>
    </Header>
  );
};

export default NavBar;
