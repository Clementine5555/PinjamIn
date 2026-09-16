import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../data/item_repository.dart';

class ItemDetailScreen extends StatelessWidget {
  const ItemDetailScreen({required this.itemId, super.key});

  final int itemId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detail Barang')),
      body: FutureBuilder<Item>(
        future: itemRepository.getItem(itemId),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(child: Text('Gagal memuat detail barang.'));
          }
          final item = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              AspectRatio(
                aspectRatio: 4 / 3,
                child: Image.network(item.imageUrl, fit: BoxFit.cover),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Rp ${item.pricePerDay} /hari',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text('${item.category} · ${item.location}'),
                    const SizedBox(height: 20),
                    Text(item.description),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () =>
                            context.push('/items/$itemId/checkout'),
                        child: const Text('Sewa Sekarang'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
