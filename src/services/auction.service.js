class AuctionService {
  async autoCloseAuction(product, productModel) {
    const now = new Date();
    const endDate = new Date(product.end_at);

    if (endDate <= now && !product.closed_at && product.is_sold === null) {
      await productModel.updateProduct(product.id, {
        closed_at: endDate,
      });

      product.closed_at = endDate;
    }
  }
}

export default new AuctionService();
