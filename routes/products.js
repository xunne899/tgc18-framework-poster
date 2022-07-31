const express = require("express");
const router = express.Router();

// import in the Product model
const { Product, MediaProperty, Tag } = require("../models");
const { createProductForm, bootstrapField } = require("../forms");

// import in the CheckIfAuthenticated middleware
const { checkIfAuthenticated } = require("../middlewares");

router.get("/", async function (req, res) {
  // fetch all the products
  // use the bookshelf syntax
  // => select * from products
  let products = await Product.collection().fetch({
    withRelated: ["mediaproperty", "tags"],
  });
  res.render("products/index.hbs", {
    products: products.toJSON(),
  });
});

router.get("/create", checkIfAuthenticated, async function (req, res) {
  const allMediaProperty = await MediaProperty.fetchAll().map((mediaproperty) => {
    return [mediaproperty.get("id"), mediaproperty.get("name")];
  });

  const allTags = await Tag.fetchAll().map((tag) => [tag.get("id"), tag.get("name")]);

  const productForm = createProductForm(allMediaProperty, allTags);
  res.render("products/create", {
    // get a HTML version of the form formatted using bootstrap
    form: productForm.toHTML(bootstrapField),
      cloudinaryName: process.env.CLOUDINARY_NAME,
      cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
      cloudinaryPreset: process.env.CLOUDINARY_UPLOAD_PRESET
  })
});

router.post("/create", checkIfAuthenticated, async function (req, res) {
  const allMediaProperty = await MediaProperty.fetchAll().map((mediaproperty) => {
    return [mediaproperty.get("id"), mediaproperty.get("name")];
  });


  const allTags = await Tag.fetchAll().map((tag) => [tag.get("id"), tag.get("name")]);

  const productForm = createProductForm(allMediaProperty,allTags);


  productForm.handle(req, {
    success: async function (form) {
      // the success function is called if the form has no validation errors
      // the form argument contains what the user has type in

      // we need to do the eqv of INSERT INTO products (name, description, cost)
      //                          VALUES (form.data.name, form.data.description, form.data.cost)

      // The MODEL represents the table
      // ONE instance of the the MODEL represents a row
      // let {tags, ...productData} = form.data;
      const product = new Product(); // create a new instance of the Product model (i.e represents a new row)
      product.set("title", form.data.name);
      product.set("cost", form.data.cost);
      product.set("description", form.data.description);
      product.set("date", form.data.date);
      product.set("stock", form.data.stock);
      product.set("height", form.data.height);
      product.set("width", form.data.width);
      product.set("mediaproperty_id", form.data.mediaproperty_id);
      // must remeber to save
      await product.save();
      if (form.data.tags) {
        await product.tags().attach(form.data.tags.split(","));
      }
      req.flash("success_messages", `New Product ${product.get("title")} has been created`);
      res.redirect("/products");
    },
    error: function (form) {
      // the error function is called if the form has validation errors
      res.render("products/create", {
        form: form.toHTML(bootstrapField),
      });
    },
    empty: function (form) {
      // the empty function is called if the form is not filled in at all
    },
  });
});

router.get("/:product_id/update", async (req, res) => {
  // retrieve the product
  const productId = req.params.product_id;
  const product = await Product.where({
    id: productId,
  }).fetch({
    require: true,
    withRelated: ["tags"],
  });

  // fetch all the tags
  const allTags = await Tag.fetchAll().map((tag) => [tag.get("id"), tag.get("name")]);

  const allMediaProperty = await MediaProperty.fetchAll().map((mediaproperty) => {
    return [mediaproperty.get("id"), mediaproperty.get("name")];
  });

  const productForm = createProductForm(allMediaProperty, allTags);

  // fill in the existing values
  productForm.fields.title.value = product.get("title");
  productForm.fields.cost.value = product.get("cost");
  productForm.fields.description.value = product.get("description");
  productForm.fields.date.value = product.get("date");
  productForm.fields.stock.value = product.get("stock");
  productForm.fields.height.value = product.get("height");
  productForm.fields.width.value = product.get("width");
  productForm.fields.mediaproperty_id.value = product.get("mediaproperty_id");
      // 1 - set the image url in the product form
      productForm.fields.image_url.value = product.get('image_url');

  let selectedTags = await product.related("tags").pluck("id");
  productForm.fields.tags.value = selectedTags;

  res.render("products/update", {
    form: productForm.toHTML(bootstrapField),
    product: product.toJSON(),
            // 2 - send to the HBS file the cloudinary information
            cloudinaryName: process.env.CLOUDINARY_NAME,
            cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
            cloudinaryPreset: process.env.CLOUDINARY_UPLOAD_PRESET
  });
});

// router.post('/:product_id/update', async (req, res) => {

//   // fetch the product that we want to update
//   const product = await Product.where({
//       'id': req.params.product_id
//   }).fetch({
//       require: true
//   });

// })
router.post("/:product_id/update", async (req, res) => {
  const allMediaProperty = await MediaProperty.fetchAll().map((mediaproperty) => {
    return [mediaproperty.get("id"), mediaproperty.get("name")];
  });

  // fetch the product that we want to update
  const product = await Product.where({
    id: req.params.product_id,
  }).fetch({
    require: true,
    withRelated: ["tags"],
  });

  // process the form
  const productForm = createProductForm(allMediaProperty);
  productForm.handle(req, {
    success: async (form) => {
      let { tags, ...productData } = form.data;
      product.set(productData);
      product.save();
      // update the tags

      let tagIds = tags.split(",");
      let existingTagIds = await product.related("tags").pluck("id");

      // remove all the tags that aren't selected anymore
      let toRemove = existingTagIds.filter((id) => tagIds.includes(id) === false);
      await product.tags().detach(toRemove);

      // add in all the tags selected in the form
      await product.tags().attach(tagIds);

      res.redirect("/products");
    },
    error: async (form) => {
      res.render("products/update", {
        form: form.toHTML(bootstrapField),
        product: product.toJSON(),
      });
    },
  });
});

router.get("/:product_id/delete", async (req, res) => {
  // fetch the product that we want to delete
  const product = await Product.where({
    id: req.params.product_id,
  }).fetch({
    require: true,
  });

  res.render("products/delete", {
    product: product.toJSON(),
  });
});

router.post("/:product_id/delete", async (req, res) => {
  // fetch the product that we want to delete
  const product = await Product.where({
    id: req.params.product_id,
  }).fetch({
    require: true,
  });
  await product.destroy();
  res.redirect("/products");
});

module.exports = router;
