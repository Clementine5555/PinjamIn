import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/product_card.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const products = [
    (
      'Sony Alpha A6400 Kit 16-50mm',
      'Rp 75.000 /hari',
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800',
    ),
    (
      'Jas Lab Kimia + Goggles',
      'Rp 15.000 /hari',
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800',
    ),
    (
      'Casio FX-991EX Ilmiah',
      'Rp 10.000 /hari',
      'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800',
    ),
    (
      'Raket Badminton',
      'Rp 20.000 /hari',
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'PinjamIn',
          style: TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: const [
          IconButton(
            onPressed: null,
            icon: Icon(Icons.search, color: AppColors.text),
          ),
          IconButton(
            onPressed: null,
            icon: Badge(
              smallSize: 7,
              child: Icon(Icons.notifications_none, color: AppColors.text),
            ),
          ),
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: CircleAvatar(
              radius: 16,
              child: Icon(Icons.person, size: 18),
            ),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Halo, Nabila! 👋',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'Mau pinjam perlengkapan apa hari ini?',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      Chip(
                        avatar: Icon(Icons.location_on, size: 16),
                        label: Text('USU Medan'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '✓ Komunitas Resmi USU',
                          style: TextStyle(
                            color: AppColors.mint,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(height: 8),
                        Text(
                          'Hemat pengeluaran kuliah.',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Sewa alat lab, buku, hingga kamera dari sesama mahasiswa sekitarmu!',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  const SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _Category(label: 'Semua', selected: true),
                        _Category(label: 'Elektronik'),
                        _Category(label: 'Peralatan Lab'),
                        _Category(label: 'Olahraga'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Tersedia di dekatmu',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'Bisa COD langsung di area kampus',
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        'Lihat Semua ›',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverGrid.builder(
              itemCount: products.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: .61,
              ),
              itemBuilder: (_, index) {
                final product = products[index];
                return ProductCard(
                  title: product.$1,
                  price: product.$2,
                  imageUrl: product.$3,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Category extends StatelessWidget {
  const _Category({required this.label, this.selected = false});
  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Chip(
        backgroundColor: selected ? AppColors.primary : Colors.white,
        side: BorderSide.none,
        label: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.text,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
