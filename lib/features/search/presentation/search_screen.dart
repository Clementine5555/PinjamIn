import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/product_card.dart';
import '../../items/data/item_repository.dart';

class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Cari Barang',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const TextField(
              decoration: InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Cari kamera, kalkulator, buku...',
              ),
            ),
            const SizedBox(height: 12),
            const SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _Chip('Semua', true),
                  _Chip('Elektronik', false),
                  _Chip('Kuliah', false),
                  _Chip('Olahraga', false),
                ],
              ),
            ),
            const SizedBox(height: 18),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hasil terdekat',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      '24 barang di sekitar USU',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
                Text(
                  'Filter',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Expanded(
              child: FutureBuilder<List<Item>>(
                future: itemRepository.getItems(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return const Center(child: Text('Gagal memuat barang.'));
                  }
                  final items = snapshot.data!;
                  return GridView.builder(
                    itemCount: items.length,
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: .61,
                        ),
                    itemBuilder: (_, index) {
                      final item = items[index];
                      return ProductCard(
                        title: item.title,
                        price: 'Rp ${item.pricePerDay} /hari',
                        imageUrl: item.imageUrl,
                        onTap: () => context.push('/items/${item.id}'),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.selected);
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
          style: TextStyle(color: selected ? Colors.white : AppColors.text),
        ),
      ),
    );
  }
}
