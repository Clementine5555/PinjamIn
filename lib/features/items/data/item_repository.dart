import 'package:supabase_flutter/supabase_flutter.dart';

class Item {
  const Item({
    required this.id,
    required this.title,
    required this.description,
    required this.pricePerDay,
    required this.imageUrl,
    required this.category,
    required this.location,
  });

  final int id;
  final String title;
  final String description;
  final int pricePerDay;
  final String imageUrl;
  final String category;
  final String location;

  factory Item.fromJson(Map<String, dynamic> json) => Item(
    id: json['id'] as int,
    title: json['title'] as String,
    description: json['description'] as String? ?? '',
    pricePerDay: json['price_per_day'] as int,
    imageUrl: json['image_url'] as String,
    category: json['category'] as String? ?? 'Lainnya',
    location: json['location'] as String? ?? 'USU Medan',
  );
}

class ItemRepository {
  ItemRepository(this._client);

  final SupabaseClient _client;

  Future<List<Item>> getItems() async {
    final rows = await _client
        .from('items')
        .select()
        .eq('is_available', true)
        .order('id');
    return rows.map(Item.fromJson).toList();
  }

  Future<Item> getItem(int id) async {
    final row = await _client.from('items').select().eq('id', id).single();
    return Item.fromJson(row);
  }
}

final itemRepository = ItemRepository(Supabase.instance.client);
