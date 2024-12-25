import React, { useEffect, useState, useCallback } from "react";
import {
  Typography,
  Card,
  Row,
  Col,
  Pagination,
  message,
  Button,
  Input,
  Modal,
} from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";


const { Title } = Typography;
const { Meta } = Card;

const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1");

type NFT = {
  id: number;
  name: string;
  description: string;
  uri: string;
  rarity: number;
  price: number;
  for_sale: boolean;
};

const MyNFTs: React.FC = () => {
  const pageSize = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [totalNFTs, setTotalNFTs] = useState(0);
  const { account, signAndSubmitTransaction } = useWallet();
  const marketplaceAddr =
    "0x3ed23f75dc96ed785388d48d31252e98e3b031fb3cdca6175f0a9c75d4489521";

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [salePrice, setSalePrice] = useState<string>("");

  const [isAuctionModalVisible, setIsAuctionModalVisible] = useState(false);
  const [auctionStartPrice, setAuctionStartPrice] = useState("");
  const [auctionDuration, setAuctionDuration] = useState("");


  const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);
const [selectedNftForTransfer, setSelectedNftForTransfer] = useState<NFT | null>(null);
const [recipientAddress, setRecipientAddress] = useState("");




  const fetchUserNFTs = useCallback(async () => {
    if (!account) return;

    try {
      const nftIdsResponse = await client.view({
        function: `${marketplaceAddr}::NFTMarketplace::get_all_nfts_for_owner`,
        arguments: [marketplaceAddr, account.address, "100", "0"],
        type_arguments: [],
      });

      const nftIds = Array.isArray(nftIdsResponse[0])
        ? nftIdsResponse[0]
        : nftIdsResponse;
      setTotalNFTs(nftIds.length);

      if (nftIds.length === 0) {
        setNfts([]);
        return;
      }

      const userNFTs = (
        await Promise.all(
          nftIds.map(async (id) => {
            try {
              const nftDetails = await client.view({
                function: `${marketplaceAddr}::NFTMarketplace::get_nft_details`,
                arguments: [marketplaceAddr, id],
                type_arguments: [],
              });

              const [
                nftId,
                owner,
                name,
                description,
                uri,
                price,
                forSale,
                rarity,
              ] = nftDetails as [
                number,
                string,
                string,
                string,
                string,
                number,
                boolean,
                number
              ];

              const hexToUint8Array = (hexString: string): Uint8Array => {
                const bytes = new Uint8Array(hexString.length / 2);
                for (let i = 0; i < hexString.length; i += 2) {
                  bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
                }
                return bytes;
              };

              return {
                id: nftId,
                name: new TextDecoder().decode(hexToUint8Array(name.slice(2))),
                description: new TextDecoder().decode(
                  hexToUint8Array(description.slice(2))
                ),
                uri: new TextDecoder().decode(hexToUint8Array(uri.slice(2))),
                rarity,
                price: price / 100000000,
                for_sale: forSale,
              };
            } catch (error) {
              console.error(`Error fetching details for NFT ID ${id}:`, error);
              return null;
            }
          })
        )
      ).filter((nft): nft is NFT => nft !== null);

      setNfts(userNFTs);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      message.error("Failed to fetch your NFTs.");
    }
  }, [account, marketplaceAddr]);

  const handleSellClick = (nft: NFT) => {
    setSelectedNft(nft);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setSelectedNft(null);
    setSalePrice("");
  };

  const handleConfirmListing = async () => {
    if (!selectedNft || !salePrice) return;

    try {
      const priceInOctas = parseFloat(salePrice) * 100000000;
      // const listingDate = Math.floor(Date.now() / 1000); 


      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::list_for_sale`,
        type_arguments: [],
        arguments: [
          marketplaceAddr,
          selectedNft.id.toString(),
          priceInOctas.toString(),
          // listingDate.toString(),
        ],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(
        entryFunctionPayload
      );
      await client.waitForTransaction(response.hash);

      message.success("NFT listed for sale successfully!");
      setIsModalVisible(false);
      setSalePrice("");
      fetchUserNFTs();
    } catch (error) {
      console.error("Error listing NFT for sale:", error);
      message.error("Failed to list NFT for sale.");
    }
  };

  useEffect(() => {
    fetchUserNFTs();
  }, [fetchUserNFTs, currentPage]);

  const paginatedNFTs = nfts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleCreateAuction = async () => {
    if (!selectedNft || !auctionStartPrice || !auctionDuration) {
        message.error("Please fill in all auction details");
        return;
    }

    try {
        const startPriceInOctas = Math.floor(parseFloat(auctionStartPrice) * 100000000);
        const durationInSeconds = Math.floor(parseFloat(auctionDuration));
        
        if (durationInSeconds < 60) {
            message.error("Auction duration must be at least 60 seconds");
            return;
        }

        const payload = {
            type: "entry_function_payload",
            function: `${marketplaceAddr}::NFTMarketplace::create_auction`,
            type_arguments: [],
            arguments: [
                marketplaceAddr,
                selectedNft.id,
                startPriceInOctas,
                durationInSeconds
            ]
        };

        try {
            const initPayload = {
                type: "entry_function_payload",
                function: `${marketplaceAddr}::NFTMarketplace::initialize_auction_store`,
                type_arguments: [],
                arguments: []
            };
            await (window as any).aptos.signAndSubmitTransaction(initPayload);
        } catch (error) {
            console.log("Auction store might already be initialized");
        }

        const response = await (window as any).aptos.signAndSubmitTransaction(payload);
        await client.waitForTransaction(response.hash);

        message.success("Auction created successfully!");
        setIsAuctionModalVisible(false);
        setAuctionStartPrice("");
        setAuctionDuration("");
        fetchUserNFTs();
    } catch (error: any) {
        console.error("Error creating auction:", error);
        message.error(error.message || "Failed to create auction. Please try again.");
    }
};


const handleTransferNFT = async () => {
  if (!selectedNftForTransfer || !recipientAddress) {
    message.error("Please fill in all required fields");
    return;
  }

  try {
    const payload = {
      type: "entry_function_payload",
      function: `${marketplaceAddr}::NFTMarketplace::transfer_nft`,
      type_arguments: [],
      arguments: [
        marketplaceAddr,
        selectedNftForTransfer.id.toString(),
        recipientAddress
      ]
    };

    const response = await (window as any).aptos.signAndSubmitTransaction(payload);
    await client.waitForTransaction(response.hash);

    message.success("NFT transferred successfully!");
    setIsTransferModalVisible(false);
    setRecipientAddress("");
    setSelectedNftForTransfer(null);
    fetchUserNFTs();
  } catch (error: any) {
    console.error("Error transferring NFT:", error);
    message.error(error.message || "Failed to transfer NFT");
  }
};



  
  
  

  return (
    <div
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Title level={2} style={{ marginBottom: "20px" }}>
        My Collection
      </Title>
      <p>Your personal collection of NFTs.</p>

      <Row
        gutter={[24, 24]}
        style={{
          marginTop: 20,
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {paginatedNFTs.map((nft) => (
          <Col
            key={nft.id}
            xs={24}
            sm={12}
            md={8}
            lg={8}
            xl={6}
            style={{
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Card
              hoverable
              style={{
                width: "100%",
                maxWidth: "280px",
                minWidth: "220px",
                margin: "0 auto",
              }}
              cover={<img alt={nft.name} src={nft.uri} />}
              actions={[
                <Button type="link" onClick={() => handleSellClick(nft)}>
                  Sell
                </Button>,
                  <Button type="link" onClick={() => {
                    setSelectedNftForTransfer(nft);
                    setIsTransferModalVisible(true);
                  }}>
                    Transfer
                  </Button>,
                <Button
                  type="link"
                  onClick={() => {
                    setSelectedNft(nft);
                    setIsAuctionModalVisible(true);
                  }}
                >
                  Send to Auction
                </Button>,
              ]}
            >
              <Meta
                title={nft.name}
                description={`Rarity: ${nft.rarity}, Price: ${nft.price} APT`}
              />
              <p>ID: {nft.id}</p>
              <p>{nft.description}</p>
              <p style={{ margin: "10px 0" }}>
                For Sale: {nft.for_sale ? "Yes" : "No"}
              </p>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ marginTop: 30, marginBottom: 30 }}>
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={totalNFTs}
          onChange={(page) => setCurrentPage(page)}
          style={{ display: "flex", justifyContent: "center" }}
        />
      </div>

      <Modal
        title="Sell NFT"
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirmListing}>
            Confirm Listing
          </Button>,
        ]}
      >
        {selectedNft && (
          <>
            <p>
              <strong>NFT ID:</strong> {selectedNft.id}
            </p>
            <p>
              <strong>Name:</strong> {selectedNft.name}
            </p>
            <p>
              <strong>Description:</strong> {selectedNft.description}
            </p>
            <p>
              <strong>Rarity:</strong> {selectedNft.rarity}
            </p>
            <p>
              <strong>Current Price:</strong> {selectedNft.price} APT
            </p>

            <Input
              type="number"
              placeholder="Enter sale price in APT"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              style={{ marginTop: 10 }}
            />
          </>
        )}
      </Modal>
      <Modal
        title="Create Auction"
        visible={isAuctionModalVisible}
        onCancel={() => setIsAuctionModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsAuctionModalVisible(false)}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={handleCreateAuction}>
            Create Auction
          </Button>,
        ]}
      >
        {selectedNft && (
          <>
            <p>
              <strong>NFT ID:</strong> {selectedNft.id}
            </p>
            <p>
              <strong>Name:</strong> {selectedNft.name}
            </p>
            <Input
    type="number"
    placeholder="Starting price in APT"
    value={auctionStartPrice}
    onChange={(e) => setAuctionStartPrice(e.target.value)}
    min={0.1}
    step={0.1}
    style={{ marginBottom: 10 }}
/>
<Input
    type="number"
    placeholder="Duration in seconds(minimum 60 seconds)"
    value={auctionDuration}
    onChange={(e) => setAuctionDuration(e.target.value)}
    min={60}
    step={1}
/>

          </>
        )}
      </Modal>
      <Modal
  title="Transfer NFT"
  visible={isTransferModalVisible}
  onCancel={() => {
    setIsTransferModalVisible(false);
    setSelectedNftForTransfer(null);
    setRecipientAddress("");
  }}
  footer={[
    <Button key="cancel" onClick={() => {
      setIsTransferModalVisible(false);
      setSelectedNftForTransfer(null);
      setRecipientAddress("");
    }}>
      Cancel
    </Button>,
    <Button 
      key="submit" 
      type="primary" 
      onClick={handleTransferNFT}
    >
      Transfer NFT
    </Button>
  ]}
>
  {selectedNftForTransfer && (
    <>
      <p><strong>NFT ID:</strong> {selectedNftForTransfer.id}</p>
      <p><strong>Name:</strong> {selectedNftForTransfer.name}</p>
      <p><strong>Description:</strong> {selectedNftForTransfer.description}</p>
      <Input
        placeholder="Enter recipient address"
        value={recipientAddress}
        onChange={(e) => setRecipientAddress(e.target.value)}
        style={{ marginTop: 10 }}
      />
      <p style={{ marginTop: 10, fontSize: '12px', color: '#888' }}>
        Please enter the complete address of the recipient
      </p>
    </>
  )}
</Modal>
    </div>
  );
};

export default MyNFTs;